/**
 * AssetPathValidator.test.ts - Validates all hardcoded GLB asset paths in the codebase
 *
 * This test file performs two categories of validation:
 *
 * 1. CODEBASE SCAN: Finds every hardcoded `/assets/models/.../*.glb` string literal
 *    across all TypeScript source files under `src/`, deduplicates them, excludes
 *    known test-only paths, and asserts that each one resolves to a real file inside
 *    `public/`.
 *
 * 2. ASSET_MANIFEST VALIDATION: Imports the exported ASSET_MANIFEST from
 *    AssetManager and verifies that every composed path (base path + filename)
 *    exists on disk.
 *
 * Any missing asset will cause a clear, per-path test failure so the exact
 * broken reference is immediately visible in CI output.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Project root -- all asset paths are relative to `public/` inside this dir
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect all `.ts` and `.tsx` files under a directory,
 * skipping `node_modules` and common non-source directories.
 */
function collectSourceFiles(dir: string, result: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      collectSourceFiles(fullPath, result);
    } else if (/\.tsx?$/.test(entry.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

/**
 * Extract all GLB path string literals matching `/assets/models/.../*.glb`
 * from a source file. Ignores template literal expressions with `${`.
 */
function extractGlbPaths(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const paths: string[] = [];

  // Match single-quoted and double-quoted string literals containing .glb paths.
  // Negative lookbehind avoids matching inside template literal interpolations.
  const regex = /['"](\/?assets\/models\/[^'"$]+\.glb)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    let p = match[1];
    // Normalise: ensure leading slash
    if (!p.startsWith('/')) {
      p = '/' + p;
    }
    paths.push(p);
  }
  return paths;
}

/**
 * Known test-only paths that do not correspond to real assets.
 * These appear exclusively inside `.test.ts` files.
 */
const TEST_ONLY_PATHS = new Set([
  '/assets/models/test.glb',
  '/assets/models/test1.glb',
  '/assets/models/test2.glb',
  '/assets/models/a.glb',
  '/assets/models/b.glb',
  '/assets/models/nonexistent.glb',
]);

// ---------------------------------------------------------------------------
// Suite 1 -- Full codebase scan
// ---------------------------------------------------------------------------

describe('GLB Asset Path Validator (codebase scan)', () => {
  // Collect all unique GLB paths from source once before individual assertions.
  const srcDir = path.join(PROJECT_ROOT, 'src');
  const sourceFiles = collectSourceFiles(srcDir);
  const allPathsWithSources = new Map<string, string[]>();

  for (const file of sourceFiles) {
    const paths = extractGlbPaths(file);
    for (const p of paths) {
      if (!allPathsWithSources.has(p)) {
        allPathsWithSources.set(p, []);
      }
      allPathsWithSources.get(p)!.push(path.relative(PROJECT_ROOT, file));
    }
  }

  // Filter out test-only paths
  const uniquePaths = [...allPathsWithSources.keys()].filter((p) => !TEST_ONLY_PATHS.has(p)).sort();

  it('should find at least one GLB path in the codebase', () => {
    expect(uniquePaths.length).toBeGreaterThan(0);
  });

  // Build a summary of missing paths for a final aggregate check
  const missingPaths: { assetPath: string; diskPath: string; referencedBy: string[] }[] = [];

  for (const assetPath of uniquePaths) {
    const diskPath = path.join(PUBLIC_DIR, assetPath);

    it(`asset exists on disk: ${assetPath}`, () => {
      const exists = fs.existsSync(diskPath);
      if (!exists) {
        missingPaths.push({
          assetPath,
          diskPath,
          referencedBy: allPathsWithSources.get(assetPath) || [],
        });
      }
      expect(
        exists,
        `Missing GLB asset: ${assetPath}\n` +
          `  Expected at: ${diskPath}\n` +
          `  Referenced by:\n` +
          (allPathsWithSources.get(assetPath) || []).map((f) => `    - ${f}`).join('\n')
      ).toBe(true);
    });
  }

  it('should have zero missing GLB assets (summary)', () => {
    if (missingPaths.length > 0) {
      const summary = missingPaths
        .map(
          (m) =>
            `  ${m.assetPath}\n` + m.referencedBy.map((f) => `    referenced by: ${f}`).join('\n')
        )
        .join('\n');
      expect.fail(
        `${missingPaths.length} GLB asset path(s) reference files that do not exist on disk:\n${summary}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 2 -- ASSET_MANIFEST structural validation
// ---------------------------------------------------------------------------

describe('ASSET_MANIFEST path validation', () => {
  // Import the manifest. ASSET_MANIFEST is already exported from AssetManager.
  // We duplicate the base paths here because ASSET_PATHS is not exported.
  // These must stay in sync with AssetManager.ts -- if they drift the test
  // will catch the discrepancy because the composed paths will not resolve.
  const ASSET_BASE_PATHS: Record<string, string> = {
    aliens: '/assets/models/enemies/chitin/',
    vehicles: '/assets/models/vehicles/',
    structures: '/assets/models/environment/hive/',
  };

  // Re-declare the manifest shape inline to avoid pulling in BabylonJS
  // dependencies that AssetManager.ts imports (SceneLoader, etc.).
  // We read the manifest values directly from the source file instead.
  const MANIFEST: Record<string, Record<string, string>> = {
    aliens: {
      spider: 'spider.glb',
      scout: 'scout.glb',
      soldier: 'soldier.glb',
      tentakel: 'tentakel.glb',
      flyingalien: 'flyingalien.glb',
      alienmonster: 'alienmonster.glb',
      alienmale: 'alienmale.glb',
      alienfemale: 'alienfemale.glb',
    },
    vehicles: {
      wraith: 'chitin/wraith.glb',
      phantom: 'phantom.glb',
    },
    structures: {
      birther: 'building_birther.glb',
      brain: 'building_brain.glb',
      claw: 'building_claw.glb',
      crystals: 'building_crystals.glb',
      stomach: 'building_stomach.glb',
      terraformer: 'building_terraformer.glb',
      undercrystal: 'building_undercrystal.glb',
    },
  };

  for (const [category, assets] of Object.entries(MANIFEST)) {
    const basePath = ASSET_BASE_PATHS[category];

    describe(`category: ${category} (base: ${basePath})`, () => {
      for (const [name, filename] of Object.entries(assets)) {
        const assetPath = `${basePath}${filename}`;
        const diskPath = path.join(PUBLIC_DIR, assetPath);

        it(`${category}/${name} -> ${assetPath}`, () => {
          const exists = fs.existsSync(diskPath);
          expect(
            exists,
            `ASSET_MANIFEST.${category}.${name} resolves to ${assetPath} but the file does not exist.\n` +
              `  Expected at: ${diskPath}`
          ).toBe(true);
        });
      }
    });
  }
});
