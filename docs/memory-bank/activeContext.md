# Active Context

## Current Development Phase
**Phase 5: Asset Conversion & Polish** (In Progress)

## Session Summary (Jan 31, 2026)

### Current Focus
1. **TypeScript Error Fixing** - Integration tests are out of sync with codebase changes
2. **MeshBuilder to GLB Conversion** - Systematic conversion of ~490 MeshBuilder calls
3. **GenAI Asset Generation** - Manifest-driven asset generation system

### Recent Changes (Jan 31, 2026)

#### Asset Reorganization
All assets consolidated under `public/assets/`:
- `public/models/` -> `public/assets/models/`
- `public/textures/` -> `public/assets/textures/`
- `public/audio/` -> `public/assets/audio/`
- `public/video/` -> `public/assets/videos/`
- Splash videos renamed: `splash-16-9.mp4` -> `main_16x9.mp4`, `splash-9-16.mp4` -> `main_9x16.mp4`

#### GenAI Asset Generation System
- Manifest-driven generation with Zod schemas
- Manifests live alongside assets (e.g., `public/assets/videos/splash/manifest.json`)
- CLI: `pnpm exec tsx scripts/generate-assets.ts [portraits|splash|cinematics|status]`
- VCR testing with Polly.JS for deterministic CI replay
- Models: Gemini 3 Pro (images), Veo 3.1 (videos)
- Video config: 1080p, 8s duration, 16:9 and 9:16 aspect ratios, native audio

#### Schema Locations
- `src/game/ai/schemas/GenerationManifestSchemas.ts` - Zod schemas for generation manifests
- `src/game/ai/schemas/AssetManifestSchemas.ts` - Zod schemas for asset metadata

### Previous Session (Jan 30, 2026)
- Completed major asset reorganization
- GLB library now contains **803 models** in `public/assets/models/`
- Quest chain system implemented
- Logger migration completed (60+ files)

### MeshBuilder Elimination Strategy

The codebase uses ~490 MeshBuilder calls that create geometry at runtime. These should be converted to pre-made GLB assets for:
- Better visual consistency with existing PSX-style assets
- Improved load times (pre-baked vs runtime generation)
- Easier artist iteration

#### Wave-Based Execution Plan

| Wave | Focus | Files | Priority |
|------|-------|-------|----------|
| **Wave 1** | FPS Weapons | Weapon view models | Critical |
| **Wave 2** | Projectiles/Effects | Bullets, grenades, explosions | High |
| **Wave 3** | Environment Props | Crates, barrels, doors | High |
| **Wave 4** | Level-Specific | Unique level geometry | Medium |
| **Wave 5** | UI/Debug | Markers, indicators | Low |

### Asset Gaps Identified

| Category | Missing Assets | Notes |
|----------|----------------|-------|
| **FPS Weapons** | First-person rifle, pistol, shotgun, SMG | No view models exist |
| **Asteroids** | Space debris, asteroid variants | Anchor Station needs |
| **Ice Crystals** | Frozen environment props | Southern Ice level |
| **Mine Assets** | Mining equipment, ore deposits | Multiple levels |

### TypeScript Status
- `pnpm exec tsc --noEmit` currently fails
- Integration tests reference outdated interfaces/methods
- Needs synchronization pass before new feature work

## FPS Completeness Analysis (from Jan 30)

#### Critical Gaps (Game-Breaking)
| Gap | Status | Priority |
|-----|--------|----------|
| Weapon Feel (recoil, shake, muzzle flash) | Missing | IMMEDIATE |
| Enemy Hit Reactions (stagger, pain, death) | Minimal | IMMEDIATE |
| Hitmarker System | Missing | IMMEDIATE |
| Player Feedback (low health, low ammo) | Basic | IMMEDIATE |

#### Scores vs AAA
- Weapon Feel: **3/10**
- Enemy Reactions: **2/10**
- Movement: **4/10**
- Audio: **4/10**
- Level Design: **5/10**
- Progression: **3/10**

## Immediate Priorities

### 1. Fix TypeScript Errors
- Update integration tests to match current interfaces
- Ensure `pnpm exec tsc --noEmit` passes

### 2. Wave 1: FPS Weapon GLBs
- Create/source first-person weapon models
- Replace MeshBuilder weapon geometry

### 3. Weapon Feel Pass
- Add visual recoil (camera kick)
- Add screen shake on firing/impact
- Improve muzzle flash with light emission
- Add shell casing particles

## Active Decisions
- **Package Manager**: PNPM exclusively (never npm/npx)
- **Quest System**: Main quests auto-activate, branch quests from objects/NPCs
- **No Skip Tutorial**: Linear campaign, unlock levels by completion
- **Immersive Storytelling**: No popups, controls learned in-game
- **Save Format**: v5 with quest chain persistence
- **Asset Strategy**: Convert all MeshBuilder calls to GLB models

## Key Files to Watch
| File | Status |
|------|--------|
| `src/game/db/CapacitorDatabase.ts` | Modified (staged) |
| `src/main.tsx` | Modified (unstaged) |
| `vite.config.ts` | Modified (unstaged) |
| `src/game/ai/schemas/GenerationManifestSchemas.ts` | GenAI manifest schemas |
| `src/game/ai/schemas/AssetManifestSchemas.ts` | Asset metadata schemas |
| `scripts/generate-assets.ts` | Asset generation CLI |
| Integration test files | Need sync with interfaces |

## Next Steps
1. Fix TypeScript compilation errors (integration tests)
2. Begin Wave 1: FPS weapon GLB conversion
3. Wire QuestManager to CampaignDirector
4. Add hitmarker system to combat
5. Add enemy hit reaction animations
