# CLAUDE.md - Stellar Descent Project Guide

This file provides guidance to Claude Code when working with the Stellar Descent codebase.

---

## CRITICAL: Package Manager

**USE PNPM, NOT NPM.**

```bash
# CORRECT
pnpm install
pnpm dev
pnpm test
pnpm exec tsc --noEmit

# WRONG - DO NOT USE
npm install   # NO
npm run dev   # NO
npm test      # NO
npx tsc       # NO - use pnpm exec tsc
```

This project uses **pnpm** exclusively. Never use npm or npx.

---

## Project Overview

Stellar Descent: Proxima Breach is a tactical arcade shooter built with:
- **React 18** - UI framework
- **BabylonJS 7** - 3D engine
- **TypeScript** - Type safety
- **Vite** - Build system with PWA support
- **Capacitor** - Mobile deployment (iOS/Android)

## Project Structure

```
stellar-descent/
├── src/
│   ├── App.tsx                    # Root component, owns GameFlow
│   ├── components/
│   │   ├── GameCanvas.tsx         # BabylonJS canvas container
│   │   ├── GameFlow.tsx           # Main gameplay UI orchestration
│   │   ├── LandingFlow.tsx        # Pre-game screens (splash, menu)
│   │   └── ui/                    # UI components (MainMenu, HUD, etc.)
│   ├── game/
│   │   ├── ai/
│   │   │   └── schemas/           # Zod schemas for GenAI manifests
│   │   │       ├── GenerationManifestSchemas.ts
│   │   │       └── AssetManifestSchemas.ts
│   │   ├── campaign/              # CampaignDirector state machine
│   │   ├── core/                  # Core systems (Audio, Logger, etc.)
│   │   ├── context/               # React contexts
│   │   ├── entities/              # Player, aliens, mech, vehicles
│   │   ├── levels/                # Level implementations
│   │   ├── persistence/           # Save system
│   │   ├── timer/                 # GameTimer, GameChronometer
│   │   └── weapons/               # Weapon systems
│   └── hooks/                     # React hooks
├── scripts/
│   └── generate-assets.ts         # GenAI asset generation CLI
├── public/
│   └── assets/                    # All game assets (consolidated)
│       ├── models/                # GLB 3D models (803+)
│       ├── audio/                 # Sound effects and music
│       ├── textures/              # Texture files
│       ├── images/                # Generated portraits, UI images
│       │   └── portraits/
│       │       └── manifest.json  # Portrait generation manifest
│       └── videos/                # Splash and cinematic videos
│           ├── splash/
│           │   ├── main_16x9.mp4  # Landscape splash
│           │   ├── main_9x16.mp4  # Portrait splash
│           │   └── manifest.json  # Splash generation manifest
│           └── cinematics/
│               └── manifest.json  # Cinematic generation manifest
└── docs/                          # Documentation
```

## Key Architecture Patterns

### CampaignDirector (The Game's Spine)

Located at `src/game/campaign/CampaignDirector.ts`, this is the central state machine that:
- Manages all campaign phases (menu, loading, playing, paused, etc.)
- Owns level transitions
- Wires achievements and collectibles
- Provides React integration via `useSyncExternalStore`

**Command Pattern**: All state mutations go through `dispatch(command)`:
```typescript
dispatch({ type: 'NEW_GAME', difficulty: 'normal', startLevel: 'anchor_station' });
dispatch({ type: 'CONTINUE' });
dispatch({ type: 'PAUSE' });
dispatch({ type: 'LEVEL_COMPLETE', stats: {...} });
```

### Level System

Levels are in `src/game/levels/` with each level in its own folder:
- `anchor_station/` - Tutorial, orbital station
- `landfall/` - HALO drop and surface exploration
- `canyon_run/` - Vehicle chase sequence
- `fob_delta/` - Base investigation
- `brothers_in_arms/` - Marcus reunion, mech combat
- `southern_ice/` - Frozen wasteland with ice variants
- `the_breach/` - Queen boss fight underground
- `hive_assault/` - Combined arms assault
- `extraction/` - Survival run to LZ
- `final_escape/` - Vehicle finale, outrun collapse

Each level implements `ILevel` interface from `src/game/levels/types.ts`.

### Factory Pattern for Levels

`src/game/levels/factories.ts` contains all level factory registrations:
```typescript
export const levelFactories: Partial<LevelFactoryRegistry> = {
  anchor_station: (context) => new AnchorStationLevel(context),
  landfall: (context) => new LandfallLevel(context),
  // ...
};
```

### Save System

`src/game/persistence/SaveSystem.ts` provides:
- Auto-save on level completion
- Manual save/load
- Campaign progress tracking
- Best times per level

### Logging

Use `src/game/core/Logger.ts` instead of `console.log`:
```typescript
import { getLogger } from '../core/Logger';
const log = getLogger('MySystem');
log.info('Message');
log.error('Error', error);
```

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Type check
pnpm exec tsc --noEmit

# Tests
pnpm test

# E2E tests (Maestro)
maestro test .maestro/

# Mobile
pnpm cap sync
pnpm cap open ios
pnpm cap open android
```

## Key Conventions

### NO FALLBACKS
**CRITICAL**: Never implement fallback or placeholder code. Every feature must be fully implemented using the proper systems:
- No "fallback to basic implementation if X fails"
- No "placeholder until real system is ready"
- No "basic AI" or "simple implementation" - use proper AI systems (YukaAI)
- No graceful degradation that hides broken features
- If something doesn't work, fix it - don't work around it
- If a system isn't initialized, ensure it gets initialized properly

### No Skip Tutorial
The game is a linear campaign. Players unlock levels by completing them. The tutorial (Anchor Station) integrates controls organically into the story - no "skip tutorial" option.

### Immersive Storytelling
- Controls are learned in-game, not via popups
- Platforming training happens in a holodeck area
- Story unfolds through Commander Reyes dialogue
- No breaking the fourth wall

### Asset Loading
Use `AssetManager` for loading GLB models:
```typescript
import { AssetManager } from '../core/AssetManager';

// Load and instance
const node = AssetManager.createInstanceByPath(
  '/assets/models/enemies/chitin/soldier.glb',
  'enemy_soldier_1',
  scene,
  false, // not animated
  'enemy' // category for LOD
);
```

### GenAI Asset Generation
Assets (portraits, splash videos, cinematics) are generated via the manifest-driven CLI:
```bash
# Generate specific asset types
pnpm exec tsx scripts/generate-assets.ts portraits          # Character portraits
pnpm exec tsx scripts/generate-assets.ts splash             # Splash/title videos
pnpm exec tsx scripts/generate-assets.ts cinematics         # Level intro cinematics
pnpm exec tsx scripts/generate-assets.ts all                # Generate everything
pnpm exec tsx scripts/generate-assets.ts status             # Show generation status

# Options
pnpm exec tsx scripts/generate-assets.ts portraits 0        # Generate specific index
pnpm exec tsx scripts/generate-assets.ts portraits --force  # Force regeneration
```

#### Manifests
Manifests live alongside their generated assets:
- `public/assets/images/portraits/manifest.json`
- `public/assets/videos/splash/manifest.json`
- `public/assets/videos/cinematics/manifest.json`

#### Schemas (Zod)
- `src/game/ai/schemas/GenerationManifestSchemas.ts` - Generation manifest validation
- `src/game/ai/schemas/AssetManifestSchemas.ts` - Asset metadata validation

#### AI Models
- **Gemini 3 Pro**: Image generation (portraits, textures)
- **Veo 3.1**: Video generation (cinematics, splash screens)

#### Video Configuration
- Resolution: 1080p
- Duration: 8 seconds
- Aspect Ratios: 16:9 (landscape) and 9:16 (portrait)
- Audio: Native AI-generated audio

#### VCR Testing (Polly.JS)
Deterministic CI testing via recorded API responses:
- Records live API responses during development
- Replays recordings in CI for reliable tests
- Avoids flaky tests and API rate limits

The system uses prompt hashing for idempotency - assets only regenerate when prompts change.

### Time Tracking
Two time systems:
1. `GameTimer` - Real-world elapsed time for speedruns
2. `GameChronometer` - In-universe time (year 3147), microsecond precision

### Lore
Game is set in year 3147 on Proxima Centauri b. Key characters:
- **Sgt. James Cole** (player) - Callsign "SPECTER"
- **Cpl. Marcus Cole** (brother) - Mech pilot, callsign "HAMMER"
- **Cmdr. Elena Vasquez** - Mission control, callsign "ACTUAL"

Enemies are the "Chitin" - insectoid aliens from underground hives.

## Important Files

| File | Purpose |
|------|---------|
| `src/game/campaign/CampaignDirector.ts` | Main game state machine |
| `src/game/campaign/types.ts` | Campaign commands and phases |
| `src/game/levels/types.ts` | Level configs and interfaces |
| `src/game/levels/factories.ts` | Level factory registry |
| `src/game/core/lore.ts` | Game lore and mission briefings |
| `src/game/core/AudioManager.ts` | Sound system |
| `src/game/core/Logger.ts` | Logging system |
| `src/game/persistence/SaveSystem.ts` | Save/load system |
| `src/game/timer/GameTimer.ts` | Mission timing |
| `src/game/timer/GameChronometer.ts` | In-universe time |
| `scripts/generate-assets.ts` | GenAI asset generation CLI |
| `src/test/vcr/VCRSetup.ts` | VCR test recording/replay for GenAI |

## UI Components

| Component | Purpose |
|-----------|---------|
| `MainMenu.tsx` | Main menu with new game flow |
| `GameHUD.tsx` | In-game HUD |
| `PauseMenu.tsx` | Pause screen |
| `DeathScreen.tsx` | Game over screen |
| `LevelCompletionScreen.tsx` | Post-level stats |
| `MissionBriefing.tsx` | Pre-mission briefing |
| `LoadingScreen.tsx` | Level loading with tips |
| `SettingsMenu.tsx` | Audio/graphics settings |
| `DifficultySelector.tsx` | Difficulty selection cards |
| `LevelSelect.tsx` | Campaign level selection |

## Testing

### Unit Tests
```bash
pnpm test
```

### E2E Tests (Maestro)
```bash
# Run all flows
maestro test .maestro/

# Run specific flow
maestro test .maestro/main-menu-navigation.yaml
```

Maestro flows are in `.maestro/` directory.

## Documentation

Detailed documentation is in the `docs/` directory:

| Document | Contents |
|----------|----------|
| `docs/ARCHITECTURE.md` | Technical architecture, ECS, physics, AI, state machines |
| `docs/DESIGN.md` | UI/UX guidelines, color system, typography, touch controls |
| `docs/LEVELS.md` | Level design documents for all 10 campaign levels |
| `docs/LORE.md` | Full game lore, character bios, enemy taxonomy |
| `docs/ASSET-INTEGRATION.md` | How to add new GLB models and textures |
| `docs/PERFORMANCE.md` | Performance optimization, LOD, mobile targets |
| `docs/TESTING.md` | Unit test patterns, E2E flow writing |
| `docs/PSX-ASSETS.md` | PSX-style asset creation guidelines |
| `docs/GENAI-ASSET-MANAGEMENT.md` | GenAI asset generation architecture |

## New Game Flow

When player clicks NEW GAME:
1. **Campaign Selection** - LevelSelect modal shows unlocked levels
2. **Difficulty Selection** - DifficultySelector modal with BACK/START buttons
3. **Start Game** - Dispatches `NEW_GAME` command with difficulty and startLevel

The flow is managed in `MainMenu.tsx` with state variables:
- `showCampaignSelect` - Campaign selection modal visible
- `showDifficultySelect` - Difficulty modal visible
- `selectedStartLevel` - Level chosen in campaign selection
- `selectedDifficulty` - Difficulty chosen

This dispatches: `{ type: 'NEW_GAME', difficulty, startLevel }` to CampaignDirector.
