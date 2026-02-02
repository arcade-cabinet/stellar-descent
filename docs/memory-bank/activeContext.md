# Active Context

## Current Development Phase
**Phase 6: Release Polish** (In Progress)

## Session Summary (Feb 1, 2026 - Latest)

### Current Focus
1. **Rendering Bug Fixes** - Fixed 3 root causes of black screen across all levels
2. **Runtime Bug Fixes** - Fixed 5 gameplay bugs found via code audit
3. **Cross-Project Hardening** - Applied PBR alpha=0 fix to infinite-headaches and otter-river-rush
4. **Level Verification** - All 11 levels pass parallel Playwright rendering tests

### Rendering Fixes (Critical - 3 Root Causes)

#### 1. PBR Shader Registration (Vite+pnpm ShaderStore Duplication)
**Root cause**: BabylonJS dynamic shader imports resolved to a DIFFERENT `ShaderStore` module instance than statically bundled code due to Vite+pnpm module resolution. PBR materials compiled with wrong shader store.
**Fix**: Static imports in `BaseLevel.ts`:
```typescript
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Shaders/pbr.vertex';
import '@babylonjs/core/Shaders/pbr.fragment';
import '@babylonjs/core/Shaders/glowMapGeneration.vertex';
import '@babylonjs/core/Shaders/glowMapGeneration.fragment';
```
**Location**: `src/game/levels/BaseLevel.ts:56-77`

#### 2. GLTF Alpha=0 Material Bug
**Root cause**: GLB models with `baseColorFactor[3]=0` and `alphaMode:"MASK"` cause BabylonJS to set `transparencyMode=1` (ALPHATEST) with `alpha=0`, discarding ALL fragments.
**Fix**: Global material observer in BaseLevel constructor:
```typescript
scene.onNewMaterialAddedObservable.add((material) => {
  if ('metallic' in material && 'roughness' in material && material.alpha === 0) {
    material.alpha = 1;
    material.transparencyMode = 0; // OPAQUE
  }
});
```
**Location**: `src/game/levels/BaseLevel.ts` constructor

#### 3. CinematicSystem Fade Overlay Leak
**Root cause**: `CinematicSystem.completeSequence()` hid letterbox bars but not the fadeOverlay. After a cinematic with a fade-out, the overlay remained visible (black screen over the game).
**Fix**: Hide fadeOverlay and reset fadeMaterial in `completeSequence()`.
**Location**: `src/game/cinematics/CinematicSystem.ts`

#### 4. Vite Shader Guard Plugin
**Root cause**: BabylonJS dynamically loads shader source via HTTP for unregistered shaders. Vite's SPA fallback serves `index.html`, which BabylonJS tries to compile as GLSL causing "SHADER ERROR: '<' : syntax error".
**Fix**: `babylonShaderGuardPlugin()` in `vite.config.ts` intercepts `.fragment`/`.vertex`/`.fx` requests and returns 404.
**Location**: `vite.config.ts:41-64`

#### 5. COOP/COEP Headers (Dev Mode)
**Root cause**: `Cross-Origin-Opener-Policy: same-origin` headers blocked Chrome extension content scripts. Game doesn't use SharedArrayBuffer (no Havok physics WASM in this project).
**Fix**: COOP/COEP headers only enabled in production mode.
**Location**: `vite.config.ts:317-323`

### Runtime Bug Fixes (5 bugs)

| Bug | File | Fix |
|-----|------|-----|
| **autoSave data loss** | `SaveSystem.ts:577` | Made `autoSave()` async, now awaits `persistSave()` |
| **Crossfade timeout leak** | `CinematicSystem.ts:750` | Track crossfade setTimeout in `pendingTimeouts` |
| **Dead bonusLevel phase** | `CampaignDirector.ts:691` | Removed unreachable `setPhase('bonusLevel')` |
| **External texture URL** | `GameCanvas.tsx:426` | Local texture instead of `assets.babylonjs.com` URL |
| **Rock IIFE unmount race** | `GameCanvas.tsx:449` | Added `if (!mounted) return` guard after async load |

### Cross-Project Hardening

Applied PBR alpha=0 fix pattern to other BabylonJS games in arcade-cabinet:

| Project | Fixes |
|---------|-------|
| **infinite-headaches** | `onNewMaterialAddedObservable` in GameScene.tsx, `babylonShaderGuardPlugin` in vite.config.ts |
| **otter-river-rush** | `onNewMaterialAddedObservable` in BabylonCanvas.tsx, `transparencyMode` on water material, shader guard |

Audited 6 more Ionic+BabylonJS projects: iron-frontier (HIGH risk), neo-tokyo (HIGH risk), protocol-silent-night (HIGH risk), sky-hats (MODERATE), rivers-of-reckoning (LOW), aethermoor (LOW).

### Previously Implemented Features

#### Station Light Tube System
Every light in the station now has a visible source - emissive fluorescent tubes.
Location: `src/game/levels/anchor-station/StationLightTubes.ts`

#### Composable Level Systems
Extracted from BaseLevel into `src/game/levels/shared/`:
- `CameraShakeSystem.ts`, `LevelStatsTracker.ts`, `VictorySystem.ts`
- `CheckpointSystem.ts`, `EnvironmentalAudio.ts`, `LevelLighting.ts`

#### ULTRA-NIGHTMARE Difficulty
Five difficulty levels: easy, normal, hard, nightmare, ultra_nightmare.
ULTRA-NIGHTMARE: 2.0x HP, 2.5x damage, forced permadeath, 2.0x XP.

#### Player Governor (Dev Mode)
Autonomous player control via Yuka AI for e2e testing.
Location: `src/game/systems/PlayerGovernor.ts`

### Build Status
- **TypeScript**: Zero errors
- **Production build**: Passes
- **Tests**: 93 files pass, 4,763 tests passed, 604 skipped
- **Level rendering**: 0 FAIL across all 11 levels (parallel Playwright test)
- **Shader errors**: NONE
- **PBR alpha=0 materials**: NONE
- **Fade overlay blocking**: NONE

## Active Decisions
- **Package Manager**: PNPM exclusively (never npm/npx)
- **No Skip Tutorial**: Linear campaign, unlock levels by completion
- **Save Format**: v5 with quest chain persistence
- **Difficulty**: 5 levels with optional permadeath toggle
- **SQLite Strategy**: Web uses sql.js, native uses Capacitor plugin
- **COOP/COEP**: Production only (not needed in dev - no SharedArrayBuffer)
- **Material Safety**: All levels protected by global `onNewMaterialAddedObservable` watcher

## Key Files to Watch
| File | Purpose |
|------|---------|
| `src/game/levels/BaseLevel.ts` | Material observer + shader imports (rendering fixes) |
| `src/game/cinematics/CinematicSystem.ts` | Fade overlay lifecycle |
| `src/game/persistence/SaveSystem.ts` | Async autoSave fix |
| `src/game/campaign/CampaignDirector.ts` | Phase transitions |
| `src/components/GameCanvas.tsx` | Engine init, menu scene, local textures |
| `vite.config.ts` | Shader guard plugin, COOP/COEP conditional |

## Known Remaining Issues
- **CampaignDirector race condition**: Rapid NEW_GAME + CONTINUE dispatches could overlap async `.then()` callbacks (low probability, menu interaction speed)
- **Failed level init still set as active**: `GameCanvas.tsx:638-650` assigns partially-initialized level on error (intentional "show something" but risky)
- **require() in ESM context**: `CampaignDirector.ts:875` and `useInputActions.ts:236` use `require()` for lazy loading (works via Vite CJS compat)
- **Player laser bolt material race**: One-frame window where materials dispose before mesh in rAF loop (cosmetic only)
- **iron-frontier, neo-tokyo, protocol-silent-night**: HIGH risk for PBR alpha=0 bug (not yet fixed, lower priority Ionic projects)

## Next Steps
1. Address remaining known issues (CampaignDirector race condition is highest priority)
2. Final production testing on mobile devices
3. Mobile app store submissions
4. Performance profiling on target devices
