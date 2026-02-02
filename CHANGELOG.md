# Changelog

All notable changes to STELLAR DESCENT: PROXIMA BREACH will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- PBR terrain material system with AmbientCG textures
- Updated level environments with procedural textures

## [1.0.0] - 2025-01-30

### Added

#### Campaign
- **10-level campaign** across 4 acts (expanded from original 6-level design)
  - ACT 1: THE DROP
    - Level 1: Anchor Station Prometheus (Tutorial)
    - Level 2: Landfall (HALO drop + first combat)
  - ACT 2: THE SEARCH
    - Level 3: Canyon Run (Vehicle chase)
    - Level 4: FOB Delta (Horror investigation)
    - Level 5: Brothers in Arms (Mech ally combat)
  - ACT 3: THE TRUTH
    - Level 6: Southern Ice (Ice variants, frozen wasteland)
    - Level 7: The Breach (Underground hive, Queen boss)
  - ACT 4: ENDGAME
    - Level 8: Hive Assault (Combined arms push)
    - Level 9: Extraction (Wave holdout at LZ Omega)
    - Level 10: Final Escape (Vehicle escape finale)

#### Save System
- **Save format v4** with full game state persistence
- Level best times tracking for speedrunning
- Difficulty persistence (Easy, Normal, Hard, Nightmare)
- Intro briefing skip flag for returning players
- Auto-save on level completion
- Export/import save as JSON for backup

#### Audio
- **Tone.js music system** with dynamic track switching
- Combat, exploration, boss, and ambient tracks
- Chapter-based music selection

#### Mobile Support
- **PWA (Progressive Web App)** with offline support
- **Capacitor integration** for native iOS/Android builds
- Touch controls with configurable sensitivity
- Landscape orientation enforcement
- Virtual joystick for movement
- Screen drag for look controls

#### UI/UX
- Death screen with restart/main menu options
- Level completion screen with time display
- Mission briefing cinematics
- Keybindings settings with full rebinding support
- Difficulty selector
- HUD visibility states (progressive unlock during tutorial)

#### Performance
- PerformanceManager with dynamic quality adjustment
- Mobile-specific optimizations (resolution scaling, particle reduction)
- LOD system with distance-based quality
- Chunk loading optimization for mobile

### Changed

#### Architecture
- **Split GameContext** into PlayerContext, CombatContext, and MissionContext
- Level system refactored to linked-list navigation
- Factory pattern for level creation
- Modular level architecture (each level is a self-contained package)

#### Testing
- Migrated from Playwright to **Maestro** for E2E tests
- Cross-platform E2E testing (Web, iOS, Android)
- Enhanced unit test coverage with Vitest

### Fixed
- Health clamping bug (was allowing negative values like -180000)
- HALO drop FOV system for proper descent feel
- Grey screen bug after loading (render loop timing issue)
- Camera sync with player turning
- Touch control sensitivity on high-DPI devices

### Technical Details

#### Save Format Migration Path
- v1 -> v2: Added difficulty field (defaults to 'normal')
- v2 -> v3: Added seenIntroBriefing field
- v3 -> v4: Added levelBestTimes record

#### Level Types
- `station` - Interior space station (Anchor Station)
- `drop` - HALO descent sequence (Landfall)
- `canyon` - Exterior surface (various)
- `base` - Abandoned outpost (FOB Delta)
- `brothers` - Mech ally combat (Brothers in Arms)
- `ice` - Frozen wasteland (Southern Ice)
- `hive` - Underground tunnels (The Breach)
- `combined_arms` - Vehicle + infantry (Hive Assault)
- `extraction` - Wave holdout (Extraction)
- `finale` - Timed escape (Final Escape)
- `vehicle` - Vehicle chase (Canyon Run)

## [0.5.0] - 2025-01-28

### Added
- Shooting range mini-game in tutorial
- Gunnery Sgt. Kowalski character
- Calibration crosshair
- Testing infrastructure (Vitest + Playwright)
- Real loading progress (replaced fake loading)

### Changed
- Tutorial flow with proper step progression
- CommsDisplay component for narrative delivery

## [0.4.0] - 2025-01-27

### Added
- Five procedural alien species with ECS tracking
  - Skitterer (STRAIN-X1): Fast swarmers
  - Lurker (STRAIN-X2): Tall thin nightmares
  - Spewer (STRAIN-X3): Acid spitters
  - Husk (STRAIN-X4): Mummified screamers
  - Broodmother (STRAIN-X5): Mini-boss
- AlienInfo component for ECS
- Skip tutorial option ("HALO DROP" button)

### Changed
- Modular level architecture (levels as sub-packages)
- Single-message comms system (story pacing)

## [0.3.0] - 2025-01-26

### Added
- DOOM-style touch controls (left joystick + screen drag)
- Weapon rack UI element
- Equipment rack interaction (suit equipping)
- Hangar depressurization sequence
- Bay doors opening animation
- Drop pod boarding and launch

### Fixed
- Grey screen bug after loading
- Event listener cleanup on level transitions
- Camera/player sync issues

## [0.2.0] - 2025-01-25

### Added
- GameManager.ts for system orchestration
- Halo drop sequence with dramatic deceleration
- CommsDisplay component for dialogue
- Manual camera controls (removed Babylon built-in conflicts)

### Changed
- Player controls rewritten for proper FPS feel
- Procedural generation spawn safety

### Fixed
- anime.js v4 import syntax issues
- Movement/firing crash
- Vite build target configuration

## [0.1.0] - 2025-01-24

### Added
- Initial project setup with bp800 template
- BabylonJS 8.x rendering engine
- Havok physics integration
- Miniplex Entity Component System
- Yuka AI steering behaviors
- SQL.js world persistence (later migrated to IndexedDB)
- Chunk-based procedural world generation
- First-person player controls
- Combat system with projectiles
- UI systems (main menu, HUD, intro sequence)
- Military design token system
- Mobile responsive utilities
- Touch controls (dual joysticks)
- Complete backstory and lore documentation

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | 2025-01-30 | Full 10-level campaign, PWA, Capacitor, Save v4 |
| 0.5.0 | 2025-01-28 | Testing infrastructure, shooting range |
| 0.4.0 | 2025-01-27 | Alien species, modular levels |
| 0.3.0 | 2025-01-26 | Touch controls, tutorial sequences |
| 0.2.0 | 2025-01-25 | GameManager, halo drop, comms |
| 0.1.0 | 2025-01-24 | Initial foundation |
