# Active Context

## Current Development Phase
**Phase 5: Polish & CI/CD** (In Progress)

## Recent Work (Session 5+ - Jan 30, 2026)

### Major Accomplishments
- **Full 6-Level Campaign**: All levels implemented (anchor_station, landfall, fob_delta, brothers_in_arms, the_breach, extraction)
- **Node 22 LTS Migration**: Updated from Node 18 to Node 22 with `.nvmrc` for version pinning
- **Netlify Deployment**: CI/CD pipeline with automatic deploys to `stellar-descent.netlify.app`
- **GitHub Actions Workflows**: Unified `ci.yml` for lint, test, build, deploy
- **Keybindings System**: Full `KeybindingsContext` with settings UI for rebinding controls
- **Tone.js Music System**: Dynamic music with combat/exploration/boss tracks by Clement Panchout
- **Death/Restart Flow**: Proper game over screen with restart mission and main menu options
- **Health Clamping Fix**: Fixed bug where health could go to -180000 (now properly clamped 0-100)
- **HALO Drop FOV System**: Dynamic FOV during freefall (1.75), powered descent (1.4), surface (1.2)
- **Mobile Landscape Enforcement**: Forces landscape on phones <768px
- **Save System**: `saveSystem.ts` with localStorage persistence for level progress

### Asset Integration (Session - Jan 30, 2026)
- **Marcus Mech**: Converted `full bot.blend` → `marcus_mech.glb` (0.56MB) with military olive/steel texturing
- **Spaceship Corridors**: Converted 6 FBX files to GLB for Anchor Station:
  - `corridor_main.glb` (7.4MB), `corridor_junction.glb` (3.9MB)
  - `corridor_corner.glb` (4.3MB), `corridor_wide.glb` (4.3MB)
  - `station_door.glb` (143KB), `station_barrel.glb` (113KB)
- **Modular Level Design**: All corridors are 4.0 units long for snap-together assembly
- **Color Philosophy**: Environment-driven palettes (blue for station calm, amber for alien sun, etc.)
- **Created**: `docs/ASSET-INTEGRATION.md` - Comprehensive asset mapping document

### Model Reorganization (Session - Jan 30, 2026)
Reorganized `public/models/` by logical domains:
```
public/models/
├── enemies/chitin/          # 8 alien enemies
├── environment/
│   ├── station/             # Anchor Station corridors + structures
│   └── hive/                # Alien hive structures
├── props/industrial/        # Doors, lights, barrels
└── vehicles/
    ├── tea/                 # marcus_mech.glb, phantom.glb
    └── chitin/              # wraith.glb
```

### Anchor Station V3 (Session - Jan 30, 2026)
Created `AnchorStationLevelV3.ts` using modular GLB corridors instead of procedural generation:
- **ModularStationBuilder.ts**: Snap-together station from GLB segments
- **Deliberate Layout Design**: Narrative-driven room flow
- **Exploration Rewards**: 8 optional rooms with discoveries:
  - Observation Deck (scenic view of planet)
  - Engine Room (hidden supply cache)
  - Crew Quarters (Marcus's locker, audio log)
  - Medical Bay (Chitin specimen in containment)
  - Biosphere (terraforming research)
- **Discovery Points**: Data pads, audio logs, Easter eggs (like Halo's skulls)
- **Room Atmospheres**: Each space has distinct emotional feel via lighting

### Testing Infrastructure
- **Vitest**: Unit testing with happy-dom
- **Playwright**: E2E testing with per-level test files
- **Coverage**: `npm run test:coverage`

## Immediate Priorities
1. **Wire Keybindings to Levels**: KeybindingsContext exists but some levels have hardcoded keys
2. **Weapon Switching UI**: Touch control weapon switch button (TODO in TouchControls.tsx:317)
3. **Ammo/Reload System**: Polish and integrate with HUD
4. **E2E Test Coverage**: Expand Playwright tests for all 6 levels
5. **Chunk Manager Mesh Loading**: TODO at ChunkManager.ts:425

## Active Decisions
- **Modular Levels**: Each level is a self-contained class implementing `ILevel` interface
- **Level Linked List**: Campaign uses `nextLevelId`/`previousLevelId` for progression
- **Ref-Based Updates**: Render loops use `useRef` to avoid stale React closures
- **Touch Controls**: DOOM-style - left joystick move, screen drag look, right side buttons
- **No Anime.js for Babylon**: Manual RAF loops for 3D animations
- **KeybindingsContext**: Centralized key management with localStorage persistence

## Known Issues
- **Touch Testing**: Needs validation on real physical devices (foldables, tablets)
- **Platforming Room**: TODO in anchor-station/environment.ts:1994
- **CanyonLevel Factory**: TODO in factories.ts:49 (currently using placeholder)

## Identified Gaps (From Codebase Review)

### TODOs Found
1. `src/game/ecs/ChunkManager.ts:425` - Load actual mesh from modelPath
2. `src/game/levels/factories.ts:49` - Implement CanyonLevel
3. `src/game/levels/anchor-station/environment.ts:1994` - Implement platforming room
4. `src/components/ui/TouchControls.tsx:317` - Implement weapon switching

### Incomplete Integrations
- Keybindings context not fully wired to all level input handlers
- Weapon system has WeaponContext but limited UI integration
- Compass navigation data exists in GameContext but minimal HUD usage
