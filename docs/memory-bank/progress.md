# Progress

## Project Timeline

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1: Foundation** | ✅ Complete | Project setup, core systems (ECS, World Gen). |
| **Phase 2: Core Gameplay** | ✅ Complete | Combat loop, AI behaviors, procedural world. |
| **Phase 3: Tutorial & Story** | ✅ Complete | Anchor Station level, dialogue system, shooting range. |
| **Phase 4: Content** | ✅ Complete | Full 10-level campaign, vehicles, boss fights. |
| **Phase 5: Polish** | ✅ Complete | GLB asset migration, architecture improvements, test fixes. |
| **Phase 6: Release** | 🔄 In Progress | Final testing, production deployment, feature polish. |

## Current Status (Phase 6 - Release)

### Completed (Feb 1, 2026 - Rendering & Bug Fix Sprint)

#### Rendering Bug Fixes ✅ (3 root causes of black screen)
- **PBR ShaderStore duplication**: Static shader imports in `BaseLevel.ts` prevent Vite+pnpm from resolving BabylonJS shaders to wrong module instance
- **GLTF alpha=0 material fix**: Global `onNewMaterialAddedObservable` in BaseLevel catches PBR materials with alpha=0 from GLB imports
- **CinematicSystem fade overlay leak**: `completeSequence()` now properly hides fadeOverlay mesh
- **Vite shader guard plugin**: `babylonShaderGuardPlugin()` returns 404 for .fragment/.vertex/.fx requests (prevents HTML-as-GLSL compilation)
- **COOP/COEP dev mode**: Headers disabled in dev mode (game doesn't use SharedArrayBuffer)
- **Level verification**: Parallel Playwright test confirms 0 FAIL across all 11 levels

#### Runtime Bug Fixes ✅ (5 bugs fixed)
- **autoSave data loss**: `SaveSystem.autoSave()` now properly awaits `persistSave()` before emitting event
- **Crossfade timeout leak**: `CinematicSystem` crossfade setTimeout now tracked in `pendingTimeouts` for cleanup
- **Dead bonusLevel phase**: Removed unreachable `setPhase('bonusLevel')` in CampaignDirector
- **External texture URL**: Replaced `https://assets.babylonjs.com/` URL with local texture for PWA offline support
- **Rock IIFE unmount race**: Added `mounted` flag check after async GLB preload in GameCanvas

#### Cross-Project Hardening ✅
- **infinite-headaches**: Added PBR alpha=0 observer and shader guard plugin
- **otter-river-rush**: Added PBR alpha=0 observer, water material transparencyMode, shader guard
- **Audited 6 more projects**: iron-frontier (HIGH), neo-tokyo (HIGH), protocol-silent-night (HIGH), sky-hats (MODERATE), rivers-of-reckoning (LOW), aethermoor (LOW)

#### Station Light Tube System ✅
- **Visible light fixtures**: Emissive fluorescent tube meshes along station corridors
- **Visual justification**: Every light source now has a visible fixture (not invisible point lights)
- **Location**: `src/game/levels/anchor-station/StationLightTubes.ts`
- **Integration**: `AnchorStationLevel.ts` uses light tubes for all corridor lighting
- **Features**:
  - `addLightTube()` - Single tube fixture
  - `addLightTubeRun()` - Corridor lighting strip
  - `addCeilingLights()` - Room ceiling grid
  - `addCorridorLights()` - Automatic spacing along path
  - `setEmergencyMode()` - Red alert lighting
  - `flickerTube()` - Damage effects

#### Composable Level Systems ✅
- **Extracted from BaseLevel monolith** for composition over inheritance
- **Location**: `src/game/levels/shared/`
- **Systems created**:
  - `CameraShakeSystem.ts` - Screen shake effects
  - `LevelStatsTracker.ts` - Kills, accuracy, secrets, time tracking
  - `VictorySystem.ts` - Objective tracking and victory conditions
  - `CheckpointSystem.ts` - Save points and respawning
  - `EnvironmentalAudio.ts` - Ambient audio wrapper
  - `LevelLighting.ts` - PBR-calibrated lighting presets

#### PBR Lighting Calibration ✅
- **Station lighting**: Bright fluorescent (intensity 5-15 for PBR)
- **Surface lighting**: Harsh alien sun
- **Underground/Hive**: Bioluminescent effects
- **Light presets**: station, surface, underground, hive, space

### Completed (Jan 31, 2026)

#### Difficulty System Overhaul ✅
- **5 difficulty levels**: easy, normal, hard, nightmare, ultra_nightmare
- **ULTRA-NIGHTMARE mode**: Extreme difficulty with forced permadeath (DOOM-inspired)
  - 2.0x enemy health, 2.5x enemy damage, no health regen
  - One death ends entire campaign
  - 2.0x XP multiplier for masochists
- **Permadeath toggle**: Optional +50% XP on any difficulty
- **DifficultyManager singleton**: Centralized difficulty management with listener support

#### SQLite Persistence Split ✅
- **Native platforms**: `CapacitorDatabase.ts` using @capacitor-community/sqlite
- **Web platform**: `WebSQLiteDatabase.ts` using sql.js with IndexedDB
- **Race condition fix**: Singleton init promise prevents duplicate initWebStore() calls
- **Platform detection**: Automatic routing via `Capacitor.isNativePlatform()`

#### Player Governor (Dev Mode) ✅
- **Autonomous player control**: Yuka AI behaviors for testing
- **DevMenu toggle**: "Player Governor (Unlock All)" checkbox
- **Goal system**: navigate, engage_enemies, advance_dialogue, complete_tutorial
- **E2E testing support**: Event-driven verification

#### Leaderboard System ✅
- **Local leaderboards**: SQLite storage via capacitorDb
- **Categories**: speedrun, high score, accuracy, kills
- **Per-level and global**: Tracks best times, scores, stats
- **Personal bests**: Difficulty-filtered tracking
- **UI component**: `LeaderboardScreen.tsx`

#### Internationalization (i18n) ✅
- **Translation system**: `t()` function with key-based lookups
- **Language management**: `getLanguage()`, `setLanguage()`, `onLanguageChange()`
- **React hooks**: `useTranslation()`, `useT()`
- **UI selector**: `LanguageSelector.tsx`

#### Game Mode Manager ✅
- **Unified modifiers**: Combines difficulty, NG+, skulls
- **Modes**: normal, new_game_plus, arcade, survival
- **Combined modifiers**: Enemy stats, player stats, resources, gameplay flags

#### GLB Asset Migration (Complete)
- **1,106 files modified** across the codebase
- **MeshBuilder reduced**: 589 remaining (all VFX/collision/terrain - intentional)
- **All structural geometry** now uses GLB loading via AssetManager
- **Asset reorganization**: `public/models/` → `public/assets/models/`

#### Build Status ✅
- **TypeScript**: Zero errors
- **Production build**: Passes
- **Tests**: 93 files pass, 4,763 tests passed, 604 skipped
- **Level rendering**: 0 FAIL across all 11 levels
- **Shader errors**: NONE
- **PBR alpha=0**: NONE
- **Fade overlay**: NONE

## Asset Status

### Asset Organization
All assets consolidated under `public/assets/`:
```
public/assets/
├── models/       # 803+ GLB 3D models
├── textures/     # PBR textures (AmbientCG)
├── audio/        # Sound effects and music
├── images/       # Portraits, UI elements
│   └── portraits/ # Character portraits (Cole, Marcus, Reyes, Athena)
├── videos/
│   └── splash/   # Splash videos
└── manifests/    # Asset manifests for levels
```

### GenAI Asset Generation (Complete)
- **Portraits**: 9 generated (Cole 3, Marcus 2, Athena 2, Reyes 2)
- **Splash Videos**: 2 generated (16:9 and 9:16)
- **Cinematics**: 10 generated (one per level)
- **Total**: 21 assets, 0 pending, 0 failed

### MeshBuilder Status (Final)
- **589 remaining** - All intentionally kept for VFX/collision/terrain

## Campaign Level Status

| Level | Implementation | GLB Assets | Tests |
|-------|---------------|------------|-------|
| Anchor Station | ✅ Complete | ✅ Converted | ✅ Pass |
| Landfall | ✅ Complete | ✅ Converted | ✅ Pass |
| Canyon Run | ✅ Complete | ✅ Converted | ✅ Pass |
| FOB Delta | ✅ Complete | ✅ Converted | ✅ Pass |
| Brothers in Arms | ✅ Complete | ✅ Converted | ✅ Pass |
| Southern Ice | ✅ Complete | ✅ Converted | ✅ Pass |
| The Breach | ✅ Complete | ✅ Converted | ✅ Pass |
| Hive Assault | ✅ Complete | ✅ Converted | ✅ Pass |
| Extraction | ✅ Complete | ✅ Converted | ✅ Pass |
| Final Escape | ✅ Complete | ✅ Converted | ✅ Pass |

## Deployment
- **URL**: https://stellar-descent.netlify.app
- **CI/CD**: GitHub Actions on push to main
- **Package Manager**: **PNPM** (not npm!)
