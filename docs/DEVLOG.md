# Development Log

This document tracks the development progress, decisions, and roadmap for STELLAR DESCENT: PROXIMA BREACH. AI agents should update this log when making significant changes.

---

## Project Timeline

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Foundation | ✅ Complete | Project setup, core systems |
| Phase 2: Core Gameplay | ✅ Complete | Combat, AI, procedural world |
| Phase 3: Tutorial & Story | 🔄 In Progress | Anchor Station, dialogue, shooting range |
| Phase 4: Content | ⏳ Planned | Missions, enemies, bosses |
| Phase 5: Polish | ⏳ Planned | Audio, effects, optimization |
| Phase 6: Release | ⏳ Planned | Testing, deployment |

---

## Log Entries

### 2025-01-XX — Session 2: Mechanical Fixes & Architecture Review

**Agent**: Claude (Sonnet 4.5)

**Summary**:
Major code review and fixes for critical mechanical issues. Player couldn't move or fire due to disconnected systems. Removed problematic anime.js usage, added halo drop sequence, fixed camera controls.

**Work Completed**:

1. **Critical Bug Fixes**
   - Fixed anime.js v4 import syntax (`import { animate }` not `import anime`)
   - Removed anime.js from Babylon object animations (causes crashes)
   - Replaced all anime.js animations with manual requestAnimationFrame loops
   - Fixed vite build target (`esnext` not deprecated `modules`)

2. **GameManager Integration**
   - Created `GameManager.ts` to orchestrate all game systems
   - Properly connects Player, ChunkManager, CombatSystem, AISystem
   - Disposes menu camera and activates player camera on game start
   - Passes touch input through to Player

3. **Player Controls Overhaul**
   - Removed Babylon's built-in camera controls (caused conflicts)
   - Manual mouse look via `mousemove` event with pointer lock
   - Camera rotation stored in `rotationX`/`rotationY` and applied each frame
   - WASD movement relative to camera facing direction
   - Fixed firing - projectiles now spawn offset forward from player

4. **Halo Drop Sequence**
   - Player drops from 500 units high with dramatic deceleration
   - Camera shake during descent
   - Gradual camera leveling from looking down to horizon
   - Optimal spawn rotation (sun top-right for best visuals)
   - Controls locked during drop, unlock on touchdown

5. **Procedural Generation Refinement**
   - Spawn chunk (0,0) has no enemies, fewer obstacles
   - Enemy density scales with distance from spawn
   - Added AI component to enemies (was missing, broke AI system)

6. **New Components**
   - `CommsDisplay.tsx` - Dialogue modal for Commander briefings
   - Typewriter text effect, character portraits, message progression
   - Military-themed UI with scan lines and signal indicators

7. **Code Quality**
   - Removed all WebGPU fallback code (fail fast principle)
   - Cleaned up unused imports
   - Updated AGENTS.md with new rules (no fallbacks, no anime.js for Babylon)

**Technical Decisions**:
- **No fallbacks**: Silent fallbacks hide bugs. Code should fail explicitly.
- **No anime.js for Babylon**: The v4 API doesn't work well with BabylonJS objects. Use manual requestAnimationFrame loops.
- **Manual camera control**: Babylon's built-in controls conflict with our FPS setup. Handle all input manually.

**Known Issues**:
- Touch controls need real device testing
- Enemy AI may need tuning for difficulty
- No sound system yet
- Performance not optimized for low-end mobile

**Files Changed**:
- `src/game/core/GameManager.ts` (new)
- `src/game/entities/player.ts` (rewritten)
- `src/game/systems/combatSystem.ts` (removed anime.js)
- `src/game/entities/mech.ts` (removed anime.js)
- `src/game/world/chunkManager.ts` (added AI component, spawn safety)
- `src/components/GameCanvas.tsx` (integrated GameManager)
- `src/components/ui/CommsDisplay.tsx` (new)
- `src/App.tsx` (added briefing state)
- `vite.config.ts` (fixed build target)
- `AGENTS.md` (updated rules)

---

### 2024-XX-XX — Session 1: Initial Development

**Agent**: Claude (Sonnet 4.5)

**Summary**:
Complete initial build of the game from scratch using the bp800 BabylonJS template.

**Work Completed**:

1. **Project Setup**
   - Cloned bp800 template
   - Added dependencies: Yuka, AnimeJS, SQL.js, Miniplex, Biome 2.3
   - Configured TypeScript and Vite

2. **Core Architecture**
   - Entity Component System (Miniplex)
   - Game Manager for state orchestration
   - World Database (SQL.js) for persistence

3. **World Generation**
   - Chunk-based procedural system
   - Seeded random for consistency
   - Building, obstacle, and enemy generation
   - Load/unload based on player position

4. **Player System**
   - First-person camera
   - WASD movement
   - Mouse look
   - Shooting with projectiles

5. **AI System**
   - Yuka integration
   - State machine (idle, patrol, chase, attack, flee)
   - Enemy behaviors

6. **Combat System**
   - Projectile management
   - Collision detection
   - Damage and death handling
   - Explosions and effects

7. **UI Systems**
   - Main menu with military aesthetic
   - Intro sequence with story
   - HUD (health, kills, mission)
   - Notifications

8. **Visual Design**
   - Design token system
   - Military color palette
   - Harsh lighting setup
   - Starfield skybox shader

9. **Mobile Support**
   - Responsive utilities
   - Touch controls (dual joysticks)
   - Safe area handling
   - Device detection

10. **Lore & Story**
    - Complete backstory
    - Character profiles
    - Mission structure
    - Radio dialogue

11. **Documentation**
    - README.md
    - AGENTS.md
    - docs/DESIGN.md
    - docs/ARCHITECTURE.md
    - docs/LORE.md
    - docs/DEVLOG.md

---

## Development Plan

### MACRO LEVEL - Project Phases (Months)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FOUNDATION                                          [COMPLETE] │
│ Core engine, ECS, world generation, basic combat                        │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: CORE GAMEPLAY                                      [IN PROGRESS]│
│ Working combat loop, AI behaviors, touch controls, halo drop            │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: TUTORIAL & STORY                                     [PLANNED] │
│ Anchor Station level, Commander dialogue, quest triggers                │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: CONTENT                                              [PLANNED] │
│ All 6 missions, boss fights, enemy variety, environments               │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: POLISH                                               [PLANNED] │
│ Audio, particles, optimization, balancing                               │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 6: RELEASE                                              [PLANNED] │
│ Testing, deployment, feedback loop                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### MESO LEVEL - Current Phase Breakdown (Weeks)

**Phase 2: Core Gameplay** → **Phase 3: Tutorial & Story**

```
Week 1-2: Core Mechanics Polish
├── ✅ Fix movement/firing crash
├── ✅ Implement halo drop sequence
├── ✅ Fix camera controls (mouse look)
├── 🔄 Test and tune touch controls on real devices
├── ⏳ Enemy AI combat behavior tuning
└── ⏳ Projectile/enemy collision refinement

Week 3-4: Anchor Station Tutorial Level
├── ⏳ Design station interior layout (hangar, briefing room, armory)
├── ⏳ Create station environment meshes
├── ⏳ Implement Commander Vasquez NPC
├── ⏳ Dialogue system triggers (proximity, interaction)
├── ⏳ Quest objective system
└── ⏳ Tutorial objectives (movement, look, fire, interact)

Week 5-6: Mission Flow
├── ⏳ Drop pod launch sequence from station
├── ⏳ Transition from station to planet surface
├── ⏳ Mission objective HUD
├── ⏳ FOB Delta location and triggers
├── ⏳ Marcus Cole NPC and mech ally system
└── ⏳ Save/checkpoint system

Week 7-8: Combat Polish
├── ⏳ Weapon feedback (screen shake, muzzle flash)
├── ⏳ Enemy variety and behaviors
├── ⏳ Health pickups
├── ⏳ Damage indicators (direction)
└── ⏳ Kill streak notifications
```

### MICRO LEVEL - Immediate Tasks (Days)

**Current Sprint: Tutorial Level Foundation**

```
DAY 1-2: Anchor Station Environment
├── Create station scene (separate from planet)
├── Hangar bay with drop pod
├── Briefing room with holotable
├── Simple corridor connecting them
├── Station lighting (artificial, blue-white)
└── Viewport window showing planet below

DAY 3-4: NPC & Dialogue System
├── Commander Vasquez NPC mesh (simple humanoid)
├── NPC interaction trigger (press E / tap)
├── CommsDisplay integration for face-to-face dialogue
├── Dialogue branching (simple yes/no responses)
├── Quest acceptance flow
└── Objective markers

DAY 5-6: Tutorial Flow
├── Spawn player in briefing room
├── Commander gives briefing via dialogue
├── Player accepts mission
├── Walk to hangar objective
├── Enter drop pod trigger
├── Launch sequence → transition to planet
└── Halo drop to surface (existing system)

DAY 7: Integration & Polish
├── Full playthrough test
├── Pacing adjustments
├── Text timing
├── Bug fixes
└── Documentation update
```

---

## Technical Debt

| Item | Priority | Status | Description |
|------|----------|--------|-------------|
| Type safety | Medium | Open | Some `any` types need proper interfaces |
| Error handling | Medium | Open | Add try/catch for async operations (with proper error display, not fallbacks) |
| Memory leaks | High | Open | Ensure all disposals are called |
| Code duplication | Low | Open | Some UI code could be abstracted |
| Testing | High | ✅ Done | Unit tests (Vitest) and E2E tests (Playwright) added |
| Touch controls | High | Open | Need real device testing |
| Fake loading | Medium | ✅ Done | LoadingModal now uses real progress |

---

## Architecture Notes

### Scene Management
Currently single scene. For Anchor Station, consider:
- Option A: Single scene, teleport player to station area
- Option B: Multiple scenes with asset preloading
- **Recommendation**: Option A for simplicity, station as distant area

### Dialogue System
`CommsDisplay` works for radio comms. For face-to-face:
- Same component, different presentation?
- Or dedicated `DialoguePanel` component?
- **Recommendation**: Extend CommsDisplay with `mode: 'radio' | 'face-to-face'`

### Quest System
Not yet implemented. Needs:
- Quest definition structure
- Active quest tracking
- Objective completion checks
- Reward/progression triggers
- **Recommendation**: Simple state machine, quest definitions in lore.ts

---

## Performance Metrics

*To be filled in during optimization phase*

| Device | FPS | Notes |
|--------|-----|-------|
| Desktop Chrome | - | - |
| iPhone 15 | - | - |
| Pixel 8a | - | - |
| Galaxy Fold | - | - |

---

## Design Decisions Record

### Decision: No Fallbacks
**Date**: Session 2
**Rationale**: Silent fallbacks hide real bugs. When WebGPU fails, we need to see WHY, not silently use WebGL. This caused hours of debugging when anime.js v4 broke - errors were swallowed.

### Decision: No anime.js for Babylon Objects
**Date**: Session 2
**Rationale**: anime.js v4 doesn't animate BabylonJS Vector3/Color3 properties correctly. Caused firing to crash movement. Use simple requestAnimationFrame loops instead.

### Decision: Manual Camera Controls
**Date**: Session 2
**Rationale**: Babylon's built-in camera controls conflict with FPS setup. attachControl adds listeners that fight with our manual rotation. Clear camera.inputs and handle everything ourselves.

---

---

### 2025-01-XX — Session 3: Anchor Station Tutorial & Modular Levels

**Agent**: Claude (Sonnet 4.5)

**Summary**:
Major architectural refactor to support modular levels. Created the Anchor Station tutorial level as a proper sub-package. Added five procedural alien species with ECS tracking. Improved game flow with proper story pacing through comms.

**Work Completed**:

1. **Modular Level Architecture**
   - Created `src/game/levels/anchor-station/` as a self-contained module
   - Each level is its own package: `index.ts`, `environment.ts`, `materials.ts`, `TutorialManager.ts`, `tutorialSteps.ts`
   - Shared types in `src/game/levels/shared/types.ts`
   - Removed monolithic `spaceBase.ts`

2. **Anchor Station Tutorial Level**
   - Full 3D environment: corridors, perspex windows, overhead pipes, drop pod
   - Story unfolds through comms as player completes objectives (not 8 dialogue boxes at once)
   - Tutorial steps: wake up → move → look → commander briefing → walk to pod → launch
   - Visual objective markers on floor
   - Guide stripe leading to drop pod

3. **Five Procedural Alien Species (ECS Tracked)**
   - **Skitterer (STRAIN-X1)**: Spider-like, fast swarmers, multi-legged
   - **Lurker (STRAIN-X2)**: Tall thin nightmare, extending claws
   - **Spewer (STRAIN-X3)**: Bloated acid-spitter with sacs
   - **Husk (STRAIN-X4)**: Dried mummified horror, screamer
   - **Broodmother (STRAIN-X5)**: Mini-boss, spawns skitterers
   - All have unique meshes, stats, loot tables tracked in Miniplex ECS
   - Added `AlienInfo` component: `speciesId`, `seed`, `xpValue`, `lootTable`

4. **Improved Game Flow**
   - Game states: `menu` → `loading` → `tutorial` OR `dropping` → `playing`
   - **Skip Tutorial option**: "HALO DROP" button goes straight to surface
   - Comms display updated to single-message system (not message array)
   - Tutorial HUD shows current objective

5. **GameContext Enhancements**
   - Added `showComms(message)` / `hideComms()` for story comms
   - Added `setObjective(title, instructions)` for tutorial objectives
   - Added `CommsMessage` type export

6. **Database Tracking Ready**
   - `alien_kills` table tracks per-species: total killed, damage dealt/received
   - `inventory` table for loot drops
   - `quests` table for mission tracking
   - `tutorial_progress` for skip-on-replay

**Technical Decisions**:
- **Modular levels**: Each anchor/chapter is its own sub-package to avoid monoliths
- **Story through comms**: No dialogue box spam - messages appear as objectives complete
- **Procedural aliens over humans**: Aliens are simpler to generate than realistic humans

**Known Issues**:
- Camera sync with player turning still needs verification
- Touch controls need real device testing
- Drop sequence transition needs polish

**Files Added**:
- `src/game/levels/anchor-station/index.ts`
- `src/game/levels/anchor-station/AnchorStationLevel.ts`
- `src/game/levels/anchor-station/TutorialManager.ts`
- `src/game/levels/anchor-station/tutorialSteps.ts`
- `src/game/levels/anchor-station/environment.ts`
- `src/game/levels/anchor-station/materials.ts`
- `src/game/levels/shared/types.ts`

**Files Modified**:
- `src/App.tsx` - New game state flow
- `src/components/GameCanvas.tsx` - Level switching
- `src/components/ui/MainMenu.tsx` - Skip tutorial button
- `src/components/ui/CommsDisplay.tsx` - Single message system
- `src/game/context/GameContext.tsx` - Comms and objective state
- `src/game/core/ecs.ts` - Added AlienInfo component
- `src/game/entities/aliens.ts` - Species tracking
- `src/css/main.css` - Tutorial HUD styles

**Files Removed**:
- `src/game/levels/spaceBase.ts` (replaced by modular system)

---

### 2025-01-XX — Session 3b: Bug Fixes & Touch Control Redesign

**Agent**: Claude (Sonnet 4.5)

**Summary**:
Fixed grey screen bug after loading. Redesigned touch controls to be proper FPS style - left joystick for movement, screen drag for looking, right side action buttons, bottom weapon rack like DOOM.

**Work Completed**:

1. **Fixed Grey Screen Bug**
   - Render loop was checking `prevGameStateRef.current` which wasn't updated yet
   - Changed to check actual refs (`tutorialLevelRef.current`, `gameManagerRef.current`) directly
   - Levels now update based on existence of their refs, not state

2. **Touch Controls Redesign (DOOM-style)**
   - **Left side**: Single joystick for movement only
   - **Center screen**: Touch and drag to look around (no right joystick!)
   - **Right side**: Action button column - FIRE (large), JUMP, CROUCH, RUN
   - **Bottom center**: Weapon rack showing slots 1/2/3 (RIFLE, PISTOL, NADE)
   - Removed confusing dual-joystick setup

3. **Event Listener Cleanup**
   - AnchorStationLevel now properly binds and removes event handlers
   - Prevents memory leaks when transitioning between levels
   - Stored bound handlers as class properties for cleanup

4. **Camera/Player Sync**
   - Fixed FOV to 1.2 (~69 degrees) - proper FPS feel
   - Camera rotation is applied directly from stored rotationX/Y each frame
   - Touch look input uses delta values (not continuous joystick values)

**Technical Decisions**:
- **No look joystick**: Touch FPS games work better with screen-drag for looking. Joystick for look feels laggy.
- **Weapon rack**: Setting up UI infrastructure for weapon switching even if not functional yet
- **Ref-based updates**: Render loop checks refs directly rather than relying on React state timing

**Files Modified**:
- `src/components/GameCanvas.tsx` - Fixed render loop update logic
- `src/components/ui/TouchControls.tsx` - Complete redesign
- `src/components/ui/TouchControls.module.css` - New DOOM-style layout
- `src/game/levels/anchor-station/AnchorStationLevel.ts` - Event cleanup
- `src/game/entities/player.ts` - Touch look sensitivity fix
- `src/game/types.ts` - Added isJumping, isCrouching to TouchInput

---

### 2025-01-XX — Session 3c: Full Tutorial Sequence Implementation

**Agent**: Claude (Sonnet 4.5)

**Summary**:
Implemented the complete tutorial end sequence: equipment rack interaction, suit equipping, hangar depressurization, bay doors opening to reveal the planet, walk to drop pod, and launch sequence.

**Work Completed**:

1. **Expanded Tutorial Steps**
   - Added equipment rack interaction step (press E to equip suit)
   - Added suit equipped confirmation
   - Added hangar bay airlock approach
   - Added depressurization warning and atmosphere venting
   - Added bay doors opening sequence
   - Added drop pod boarding and launch

2. **Equipment Rack System**
   - Visual suit on rack (capsule body + sphere helmet)
   - Pulsing green interaction light
   - Press E / tap to interact when in range
   - Suit disappears when equipped
   - Notification "EVA SUIT EQUIPPED"

3. **Hangar Bay Environment**
   - Extended corridor: prep bay (25 units) + hangar (30 units)
   - Inner airlock door with status lights
   - Bay doors at end (left/right sliding)
   - Caution stripes on bay doors (yellow/red alternating)
   - Industrial orange lighting in hangar section

4. **Animated Sequences**
   - `playEquipSuit()` - Fades out suit meshes
   - `playDepressurize()` - Door lights turn red, pulse
   - `playOpenBayDoors()` - Doors slide apart dramatically
   - `playEnterPod()` - Locks player position in pod
   - `playLaunch()` - Pod drops away from station

5. **Interaction System**
   - HTML overlay prompt showing "E - INTERACT"
   - Shows when player in range of interactable
   - Works with keyboard (E key) and touch (tap)
   - TutorialManager tracks `canInteract` state

6. **Tutorial Flow Refinement**
   - Steps have `triggerSequence` property for animations
   - `interactId` for interact-type objectives
   - Proper pacing between steps
   - Auto-advance for wait steps, manual for move/interact

**Technical Details**:
- Environment returns animation play functions
- Each animation takes a callback for completion
- Station layout: 0 → -25 (prep bay) → -55 (hangar end)
- Equipment rack at (-3.5, 0, -18)
- Inner door at z = -25
- Drop pod at z = -47

**Files Modified**:
- `src/game/levels/anchor-station/tutorialSteps.ts` - Full sequence
- `src/game/levels/anchor-station/environment.ts` - Hangar bay, animations
- `src/game/levels/anchor-station/TutorialManager.ts` - Sequence triggers
- `src/game/levels/anchor-station/AnchorStationLevel.ts` - Interaction handling

---

---

### 2025-01-30 — Session 4: Testing Infrastructure & Shooting Range Mini-Game

**Agent**: Claude (Sonnet 4.5)

**Summary**:
Added comprehensive testing infrastructure with Vitest for unit tests and Playwright for E2E tests. Implemented weapons calibration shooting range mini-game in the tutorial. Fixed fake loading screen to use real asset loading progress.

**Work Completed**:

1. **Testing Infrastructure**
   - Added Vitest for unit testing with happy-dom environment
   - Added Playwright for E2E testing with Chromium
   - Created test setup with WebGL mocks (`src/test/setup.ts`)
   - 46 unit tests passing across 3 test files
   - E2E tests with screenshot capture

2. **Shooting Range / Weapons Calibration Mini-Game**
   - New tutorial sequence after suiting up
   - Gunnery Sgt. Kowalski (ARMORY) character with gruff dialogue
   - 5 holographic targets that appear in shooting range area
   - Click to shoot with raycasting hit detection
   - Visual feedback: targets flash green and disappear when hit
   - Orange calibration crosshair appears during mini-game
   - New portrait type 'armory' with orange accent color

3. **Fixed Fake Loading**
   - `LoadingModal` now accepts real progress updates
   - `GameCanvas` reports actual loading stages
   - No more hardcoded fake timers

4. **New Tutorial Dialogue**
   - Kowalski: "Hold up, Cole. Calibrate your sidearm before drop. You know better."
   - Kowalski: "Lane two. And don't give me that look - I don't care if you can hit an LGM at 500 klicks. We don't drop without calibration."
   - Kowalski: "Still got it. Now move your ass, Marine - brass wants you planetside five minutes ago."

5. **Documentation**
   - Created `docs/TESTING.md` with full testing guide
   - Updated README.md with test commands
   - Updated DEVLOG.md with session log

**Technical Details**:
- Shooting range at position (3.5, 0, -18) - opposite equipment rack
- Targets stored in array: [center0, ring0, center1, ring1, ...]
- Hit detection via ray-sphere intersection with 0.25 radius
- `isCalibrating` state in GameContext controls crosshair visibility
- New objective type: `shooting_range` in TutorialManager

**Test Files Created**:
- `src/test/setup.ts` - WebGL mocks, global setup
- `src/game/context/GameContext.test.tsx` - 12 tests
- `src/game/levels/anchor-station/TutorialManager.test.ts` - 15 tests
- `src/game/levels/anchor-station/tutorialSteps.test.ts` - 19 tests
- `e2e/game-flow.spec.ts` - Main flow E2E tests
- `e2e/shooting-range.spec.ts` - Shooting range E2E tests
- `e2e/smoke-screenshots.spec.ts` - Screenshot capture tests
- `e2e/playthrough.spec.ts` - Full playthrough tests

**Files Modified**:
- `src/game/levels/anchor-station/tutorialSteps.ts` - Added shooting range steps
- `src/game/levels/anchor-station/TutorialManager.ts` - Added shooting_range objective
- `src/game/levels/anchor-station/AnchorStationLevel.ts` - Shooting mechanics
- `src/game/levels/anchor-station/environment.ts` - Shooting range geometry
- `src/game/context/GameContext.tsx` - Added isCalibrating state
- `src/components/GameCanvas.tsx` - Real loading progress
- `src/components/ui/LoadingModal.tsx` - Accept progress prop
- `src/components/ui/CommsDisplay.tsx` - Added armory portrait
- `src/App.tsx` - Calibration crosshair in tutorial HUD
- `src/css/main.css` - Calibration crosshair styles
- `package.json` - Test scripts
- `vitest.config.ts` - Unit test config
- `playwright.config.ts` - E2E test config

**New Dependencies**:
- `vitest` - Unit test framework
- `@vitest/ui` - Test UI
- `@testing-library/react` - React testing utilities
- `@testing-library/dom` - DOM testing utilities
- `happy-dom` - Fast DOM implementation
- `playwright` - E2E testing
- `@playwright/test` - Playwright test runner

---

## Next Session Priorities

1. **First-person view** - Gloved hands holding weapon
2. **HALO drop polish** - Planet visible during descent, camera looking down
3. **Weapon system** - Functional weapon switching
4. **View bobbing** - Head bob while walking
5. **Sound effects** - Suit equip, depressurize, bay doors, launch
6. **E2E test coverage** - More comprehensive playthrough tests

---

*"The mission continues. Log your progress, Marine."*
