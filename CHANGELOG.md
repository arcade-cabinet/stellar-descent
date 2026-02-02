# Changelog

All notable changes to STELLAR DESCENT: PROXIMA BREACH will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0](https://github.com/arcade-cabinet/stellar-descent/compare/v1.0.0...v1.1.0) (2026-02-02)


### Features

* Add loglevel logging library, remove Babylon logo ([a66cc82](https://github.com/arcade-cabinet/stellar-descent/commit/a66cc8262825e1e108bd6acc4e0e8908e30a7b8d))
* Add quest chain system and complete logger migration ([4db11c1](https://github.com/arcade-cabinet/stellar-descent/commit/4db11c14c8801717009318617014d8273fef364f))
* **ci:** Add multi-platform CI/CD with SHA-pinned actions ([3f1d58a](https://github.com/arcade-cabinet/stellar-descent/commit/3f1d58adf3ff74b50dd70123628d402acf6b72b1))
* **ci:** Add staging/production release environments and fastlane configs ([fda53d5](https://github.com/arcade-cabinet/stellar-descent/commit/fda53d50a26a5795de87e79e064e8a194f8f90fe))
* Complete 10-level campaign with vehicles, PWA, and full polish ([9a31fc6](https://github.com/arcade-cabinet/stellar-descent/commit/9a31fc637dfd994bfdfd94803fc13a44f740587b))
* Complete GLB asset migration and architecture improvements ([2e056fc](https://github.com/arcade-cabinet/stellar-descent/commit/2e056fcc3c10d60ca553fcb3003edea300e17bbc))
* Complete production-ready FPS game implementation ([e6d9744](https://github.com/arcade-cabinet/stellar-descent/commit/e6d9744359833b1fa16e0f3c8340e48cb276bfa7))
* Complete production-ready game with GLB assets and architecture improvements ([7cd5bc1](https://github.com/arcade-cabinet/stellar-descent/commit/7cd5bc10ac1c7026bfed828dd88fda4cf2266e2f))
* Comprehensive FPS game feel improvements ([cb740de](https://github.com/arcade-cabinet/stellar-descent/commit/cb740de0a87ec776f1bc0cdb99df819516c12538))
* **dev:** Add Player Governor mode to unlock all levels ([5378db5](https://github.com/arcade-cabinet/stellar-descent/commit/5378db5b2577a07318755b3aa8e9097ab6ca2385))
* **difficulty:** Add DifficultyRegistry + Zustand store with SQLite ([8d2dc48](https://github.com/arcade-cabinet/stellar-descent/commit/8d2dc486e4fbb9eda90c483c452994a3ba6a14dc))
* **difficulty:** Add ULTRA-NIGHTMARE difficulty + permadeath toggle ([da66e72](https://github.com/arcade-cabinet/stellar-descent/commit/da66e725c5b8e9f853664dd236f3f249c90405f7))
* **e2e:** Add comprehensive Playwright E2E test suite for all 10 levels ([93cc68a](https://github.com/arcade-cabinet/stellar-descent/commit/93cc68ac92dd2620e3d01065ece101dc4a0544ca))
* Production game systems - leaderboards, i18n, modes, and test coverage ([51bf8a0](https://github.com/arcade-cabinet/stellar-descent/commit/51bf8a06a9c5387b45048acc866b18b3dcbf279f))
* Simplify main menu, add build flags, integrate help modal ([7d8f148](https://github.com/arcade-cabinet/stellar-descent/commit/7d8f14880f717d7d7801bd3519ed914f56860374))


### Bug Fixes

* Add all missing TypeScript property declarations ([5169c55](https://github.com/arcade-cabinet/stellar-descent/commit/5169c5537e7bbe769380fdaf68befe76e81455a4))
* Address CI failures - forEach return values and stale test ([60c08a1](https://github.com/arcade-cabinet/stellar-descent/commit/60c08a1216ea8b17886a77d0dc3665b4ce28a0cd))
* Address PR review feedback ([9602266](https://github.com/arcade-cabinet/stellar-descent/commit/9602266e52fa004a39877326f1b72a44ac2ca8e9))
* Address remaining CI failures ([7db052a](https://github.com/arcade-cabinet/stellar-descent/commit/7db052add033f6f42e849f873c59226dfb1bc7b4))
* **assets:** Correct broken asset paths and add level validation tests ([9a947af](https://github.com/arcade-cabinet/stellar-descent/commit/9a947afade736bb2e97aa557bc0dbc2294d663a1))
* **assets:** Rename files with spaces, fix typos, and correct 85 broken paths ([7286a95](https://github.com/arcade-cabinet/stellar-descent/commit/7286a95f10df8d6aac56261a75553a1bdf580056))
* **assets:** Resolve all 30 missing asset paths to zero failures ([8866653](https://github.com/arcade-cabinet/stellar-descent/commit/8866653d5d1f5b2320cef4fd91cc8c8680ec02bf))
* **ci:** Replace npm/npx with pnpm across CI/CD workflows ([6eca10c](https://github.com/arcade-cabinet/stellar-descent/commit/6eca10ce1034136a7976fb14a40e6904eea55979))
* Complete sql.js web database implementation ([32c6bed](https://github.com/arcade-cabinet/stellar-descent/commit/32c6beda55f37d57cca64206644eaca71206f490))
* Deep audit of all 10 levels + campaign + entities + UI ([fad3db4](https://github.com/arcade-cabinet/stellar-descent/commit/fad3db4ce32fa1be6a94fb3eace6695b6b2f87f7))
* **e2e:** Update Anchor Station tests to handle actual game flow ([866237c](https://github.com/arcade-cabinet/stellar-descent/commit/866237c933c152c5c45b4dccbcb55cda922db3cd))
* Multiple lint and a11y fixes ([760ee7a](https://github.com/arcade-cabinet/stellar-descent/commit/760ee7ae2f1ba9f6bb4a773f33fffd559fd543f9))
* PWA auto-update + Maestro flow updates for new menu ([a847fd7](https://github.com/arcade-cabinet/stellar-descent/commit/a847fd714eb1503e4e7342dcfbba9ed9fc087a4e))
* Remove fallbacks, add game timer, fix SQLite WASM, clean procedural gen ([b3cdd45](https://github.com/arcade-cabinet/stellar-descent/commit/b3cdd45eb2dd7d4157dfe3df92cf531838ee5398))
* Rendering black screen, runtime bugs, and cross-project hardening ([9f894e2](https://github.com/arcade-cabinet/stellar-descent/commit/9f894e26c1178b0124df574e69a83c23a0ecfd2c))
* Replace jeep-sqlite with direct sql.js for web SQLite ([c245d4c](https://github.com/arcade-cabinet/stellar-descent/commit/c245d4cbef35d973e0af99415cb3d771bf0c57e3))
* Resolve all lint errors for CI ([1b8fdcb](https://github.com/arcade-cabinet/stellar-descent/commit/1b8fdcbd48c81575c444e51e1335731abab964f0))
* Resolve infinite loop and improve E2E testing setup ([a29861a](https://github.com/arcade-cabinet/stellar-descent/commit/a29861a6988687992f61f5a95c5556b6e10fbfef))
* Restore all FPS weapon GLB models from ~/assets ([54ddd4e](https://github.com/arcade-cabinet/stellar-descent/commit/54ddd4ead3a71dca3e60c5f19b2d1803318b9477))
* Restore weapon attachments and ammo box GLBs ([c1b6bef](https://github.com/arcade-cabinet/stellar-descent/commit/c1b6bef429b647e374055df9d9e38e0f33ae8f43))
* Runtime bugs (audio, DB, lighting) + comprehensive Playwright UI test suite ([#7](https://github.com/arcade-cabinet/stellar-descent/issues/7)) ([c12ae4c](https://github.com/arcade-cabinet/stellar-descent/commit/c12ae4cc28eb60ed9d0ca0542ad529738367db1a))
* **security:** Resolve 9 CodeQL alerts ([5c86519](https://github.com/arcade-cabinet/stellar-descent/commit/5c86519a6e689ac5a61b8e7dcf0db81db91e9f26))
* **security:** Resolve 9 CodeQL alerts across CI and game code ([e70643d](https://github.com/arcade-cabinet/stellar-descent/commit/e70643d28521a46a53a3b17c6f20ce4fec4445f1))
* **security:** Suppress CodeQL false positives and patch vulnerable deps ([1986766](https://github.com/arcade-cabinet/stellar-descent/commit/1986766a7917ff740bbd81e1ae4352134a79cf1a))
* **security:** Update Electron deps to resolve 3 Dependabot alerts ([f6f4f19](https://github.com/arcade-cabinet/stellar-descent/commit/f6f4f19335bc40554c3980ecfed49acfd131c580))
* **security:** Update Electron deps to resolve Dependabot alerts ([c041476](https://github.com/arcade-cabinet/stellar-descent/commit/c041476b01896680638653fee1470c939c3f2c7b))
* **station:** Eliminate black screen via instanced GLB loading and deferred rendering ([9d02e62](https://github.com/arcade-cabinet/stellar-descent/commit/9d02e6240783871ddd86c8ee05b1d3fe98d89304))
* **ui:** Move CHALLENGES button to left column ([606dad1](https://github.com/arcade-cabinet/stellar-descent/commit/606dad11570e1c35b7eb6aeca341399a6640b980))
* **ui:** START CAMPAIGN button now works without clicking difficulty ([5467391](https://github.com/arcade-cabinet/stellar-descent/commit/5467391db7e930ba15e1615b5aa8728e67bc4974))
* Update Maestro flows for simplified main menu ([a8df36d](https://github.com/arcade-cabinet/stellar-descent/commit/a8df36dcf6eea042080aead6d17483cf612abe99))
* Use correct biome config syntax for file includes ([24f50c3](https://github.com/arcade-cabinet/stellar-descent/commit/24f50c36b07de924b734acf8f3043e6212d2c75b))
* Wire all 10 campaign levels through factory system ([8c87410](https://github.com/arcade-cabinet/stellar-descent/commit/8c87410bcd356e60d362aa01bab890ce24884bff))


### Code Refactoring

* **assets:** Eliminate 27 duplicate GLBs (~35MB) and consolidate paths ([0d805f5](https://github.com/arcade-cabinet/stellar-descent/commit/0d805f5d8859cd9ee14e0f4bb9f90abd67d79df1))
* **assets:** Eliminate props/industrial directory and fix docs typo ([1a22ba0](https://github.com/arcade-cabinet/stellar-descent/commit/1a22ba06f6791425286ee9061f8f881b35c07e77))
* **difficulty:** Complete Zustand + SQLite state management ([db15fa4](https://github.com/arcade-cabinet/stellar-descent/commit/db15fa449a4c3380504821b2a2e200ca58efb0cc))
* **state:** Eliminate CombatContext, migrate to useCombatStore + EventBus ([b8f4498](https://github.com/arcade-cabinet/stellar-descent/commit/b8f4498340a9a9031eeb3cd6d3cf272e6e45b061))
* **state:** Eliminate MissionContext, replace with useMissionStore ([9c51118](https://github.com/arcade-cabinet/stellar-descent/commit/9c511188671d38e623d91316a95f8f46031eb5a1))
* **state:** Eliminate PlayerContext, migrate to usePlayerStore ([4cb71bc](https://github.com/arcade-cabinet/stellar-descent/commit/4cb71bc9c8dd7afb5df6b30b333ac435769e7ecb))
* **state:** Migrate localStorage game stats to SQLite via Zustand store ([3871ed0](https://github.com/arcade-cabinet/stellar-descent/commit/3871ed0fe4de6bae1d4326c24637b2644f569829))
* Unify LevelRegistry as single source of truth + singleton cleanup ([5d2b386](https://github.com/arcade-cabinet/stellar-descent/commit/5d2b3864109e29f8ee8b1a0f331d73bdb9bec34d))


### Documentation

* Add FPS completeness analysis and update memory bank ([8c357e9](https://github.com/arcade-cabinet/stellar-descent/commit/8c357e9b74d6634093498f2c8009979b213c3b79))
* Align memory bank and documentation with Phase 6 state ([9b96f3a](https://github.com/arcade-cabinet/stellar-descent/commit/9b96f3a75cb1953e430d80c23d9504127921f6da))
* Fix stale campaign structure in productContext.md ([97c83e7](https://github.com/arcade-cabinet/stellar-descent/commit/97c83e7dfb03a84c16b62c6426a452d493b0e1cc))
* Update memory bank with Phase 5 completion status ([59af188](https://github.com/arcade-cabinet/stellar-descent/commit/59af1880a0186d9f6ab2311e2deef0f61668d839))

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
