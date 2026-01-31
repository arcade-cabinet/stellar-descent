# Progress

## Project Timeline

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1: Foundation** | ✅ Complete | Project setup, core systems (ECS, World Gen). |
| **Phase 2: Core Gameplay** | ✅ Complete | Combat loop, AI behaviors, procedural world. |
| **Phase 3: Tutorial & Story** | ✅ Complete | Anchor Station level, dialogue system, shooting range. |
| **Phase 4: Content** | ✅ Complete | Full 10-level campaign, vehicles, boss fights. |
| **Phase 5: Polish** | 🔄 In Progress | Asset conversion, TypeScript fixes, FPS completeness. |
| **Phase 6: Release** | ⏳ Planned | Final testing, production deployment. |

## Current Status (Phase 5)

### Known Issues
- **TypeScript Errors**: Integration tests are out of sync with codebase changes; `pnpm exec tsc --noEmit` currently fails
- **MeshBuilder Usage**: ~490 MeshBuilder calls remain that should be converted to GLB assets

### Completed (Jan 30, 2026)

#### Campaign Structure (10 Levels)
- **ACT 1: THE DROP**
  - Level 1: Anchor Station Prometheus (Tutorial/Briefing)
  - Level 2: Landfall (HALO drop + first surface combat)
- **ACT 2: THE SEARCH**
  - Level 3: Canyon Run (Vehicle chase sequence)
  - Level 4: FOB Delta (Horror/Investigation)
  - Level 5: Brothers in Arms (Marcus mech ally combat)
- **ACT 3: THE TRUTH**
  - Level 6: Southern Ice (Frozen wasteland, Ice Chitin enemies)
  - Level 7: The Breach (Underground hive, Queen boss fight)
- **ACT 4: ENDGAME**
  - Level 8: Hive Assault (Combined arms push)
  - Level 9: Extraction (LZ Omega holdout)
  - Level 10: Final Escape (Vehicle finale, outrun collapse)

#### Systems Implemented
- **Quest Chain System**: 10 main quests + 18 optional branch quests
- **GameChronometer**: In-universe time tracking (year 3147)
- **Centralized Logger**: 60+ files migrated from console.log
- **Save System v5**: Quest persistence, level flags, best times
- **PWA Support**: Offline play, install prompt
- **Difficulty Settings**: Recruit, Normal, Veteran, Legendary
- **Colorblind Modes**: Deuteranopia, Protanopia, Tritanopia
- **Vehicle Systems**: Phantom dropship, Wraith tank, Warthog
- **Enemy Vehicles**: Wraith AI with mortar attacks
- **Skull System**: Collectible modifiers like Halo
- **Audio Logs**: Discoverable lore throughout campaign
- **Secret Areas**: Hidden rooms with rewards
- **Achievement System**: 30+ achievements

### In Progress
- **TypeScript Error Fixing**: Integration tests out of sync with codebase
- **MeshBuilder to GLB Conversion**: ~490 MeshBuilder calls to convert
- **FPS Completeness Pass**: Weapon feel, hit reactions, game juice
- **Quest Integration**: Wire QuestManager to CampaignDirector
- **Level Polish**: Environmental storytelling, alternate routes

## Asset Status

### Asset Organization
All assets now consolidated under `public/assets/`:
```
public/assets/
├── models/       # 803+ GLB 3D models
├── textures/     # Texture files
├── audio/        # Sound effects and music
└── videos/
    └── splash/   # Splash videos (main_16x9.mp4, main_9x16.mp4)
```

### GLB Model Library
- **Total GLBs**: 803 models in `public/assets/models/`
- **Previous Session**: Completed major asset reorganization and consolidation

### GenAI Asset Generation System
- **CLI**: `pnpm exec tsx scripts/generate-assets.ts [portraits|splash|cinematics|status]`
- **Manifests**: Live alongside assets (e.g., `public/assets/videos/splash/manifest.json`)
- **Schemas**:
  - `src/game/ai/schemas/GenerationManifestSchemas.ts` - Generation manifests
  - `src/game/ai/schemas/AssetManifestSchemas.ts` - Asset metadata
- **Models**:
  - Gemini 3 Pro - Image generation (portraits, textures)
  - Veo 3.1 - Video generation (cinematics, splash screens)
- **Video Config**: 1080p, 8s duration, 16:9/9:16 aspect ratios, native audio
- **Testing**: VCR testing with Polly.JS for deterministic CI replay

### MeshBuilder Elimination Goal
The codebase contains ~490 MeshBuilder calls that should be converted to proper GLB assets for consistency and performance. A Wave-based execution plan exists for systematic conversion.

#### Wave-Based Conversion Plan
| Wave | Category | Priority | Scope |
|------|----------|----------|-------|
| Wave 1 | FPS Weapons | Critical | First-person weapon models (rifle, pistol, shotgun, etc.) |
| Wave 2 | Projectiles/Effects | High | Bullets, grenades, explosions, muzzle flashes |
| Wave 3 | Environment Props | High | Crates, barrels, doors, terminals |
| Wave 4 | Level-Specific | Medium | Per-level unique geometry |
| Wave 5 | UI/Debug | Low | Markers, indicators, debug shapes |

### Asset Gaps Identified
| Category | Missing Assets | Priority |
|----------|----------------|----------|
| FPS Weapons | First-person weapon models | Critical |
| Asteroids | Space debris, asteroid variants | High |
| Ice Crystals | Frozen environment props | High |
| Mine Assets | Mining equipment, ore deposits | Medium |

## Campaign Level Status

| Level | Implementation | Environment | Enemies | Boss |
|-------|---------------|-------------|---------|------|
| Anchor Station | ✅ Complete | ✅ GLB Models | N/A | N/A |
| Landfall | ✅ Complete | ✅ Terrain | ✅ Chitin | N/A |
| Canyon Run | ✅ Complete | ✅ Vehicle Track | ✅ Wraith | N/A |
| FOB Delta | ✅ Complete | ✅ Modular Base | ✅ Stealth | N/A |
| Brothers in Arms | ✅ Complete | ✅ Battlefield | ✅ Waves | N/A |
| Southern Ice | ✅ Complete | ✅ Ice Terrain | ✅ Ice Chitin | N/A |
| The Breach | ✅ Complete | ✅ Hive | ✅ Swarm | ✅ Queen |
| Hive Assault | ✅ Complete | ✅ Hive/Surface | ✅ Marines | N/A |
| Extraction | ✅ Complete | ✅ LZ Omega | ✅ Waves | N/A |
| Final Escape | ✅ Complete | ✅ Collapse | ✅ Chase | N/A |

## Critical Gaps (FPS Completeness)

Based on FPS-COMPLETENESS-ANALYSIS.md:

### Immediate Priority
1. **Weapon Feel** - Recoil, screen shake, muzzle flash, shell casings
2. **Enemy Hit Reactions** - Stagger, pain sounds, death variations
3. **Hitmarker System** - Visual/audio hit confirmation
4. **Player Feedback** - Low health, low ammo, damage direction

### Short-Term
5. **Movement Polish** - Slide, mantle, lean, sprint FOV
6. **Audio Pass** - Weapon sounds, enemy sounds, positional audio
7. **Resource Loop** - Visible ammo/health pickups
8. **Enemy AI** - Flanking, cover usage, grenades

### Current Ratings (vs AAA FPS)
| Category | Score | Notes |
|----------|-------|-------|
| Weapon Feel | 3/10 | Needs recoil, shake, impact |
| Enemy Reactions | 2/10 | Needs stagger, death variety |
| Movement | 4/10 | Needs slide, mantle |
| Audio | 4/10 | Needs positional, variety |
| Level Design | 5/10 | Needs verticality, puzzles |
| Progression | 3/10 | Needs skill tree/perks |

## Deployment
- **URL**: https://stellar-descent.netlify.app
- **CI/CD**: GitHub Actions on push to main
- **Package Manager**: **PNPM** (not npm!)
