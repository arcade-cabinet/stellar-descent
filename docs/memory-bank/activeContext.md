# Active Context

## Current Development Phase
**Phase 6: Release** (In Progress)

## Session Summary (Jan 31, 2026)

### Current Focus
1. **Documentation Alignment** - Memory bank docs need sync with recent features
2. **Final Testing** - Production deployment verification
3. **Feature Polish** - Recently completed difficulty, persistence, and social systems

### Recently Implemented Features

#### ULTRA-NIGHTMARE Difficulty
New extreme difficulty mode with forced permadeath (inspired by DOOM Eternal):
- Location: `src/game/core/DifficultySettings.ts`
- Five difficulty levels: easy, normal, hard, nightmare, ultra_nightmare
- ULTRA-NIGHTMARE features:
  - 2.0x enemy health, 2.5x enemy damage
  - No health regeneration
  - Forced permadeath (one death ends campaign)
  - 2.0x XP multiplier
- UI: `src/components/ui/DifficultySelector.tsx` shows bottom row with nightmare | permadeath toggle | ultra-nightmare

#### Permadeath Toggle System
Optional permadeath mode that can be enabled on any difficulty:
- Stored in localStorage (`stellar_descent_permadeath`)
- Adds +50% XP bonus when enabled
- Functions: `loadPermadeathSetting()`, `savePermadeathSetting()`, `isPermadeathActive()`
- ULTRA-NIGHTMARE always forces permadeath regardless of toggle

#### Player Governor (Dev Mode)
Autonomous player control system for e2e testing and level unlocking:
- Location: `src/game/systems/PlayerGovernor.ts`
- Uses Yuka AI behaviors to control player character
- DevMenu toggle (`src/components/ui/DevMenu.tsx`): "Player Governor (Unlock All)"
- Enables: `devMode.allLevelsUnlocked` flag in `src/game/core/DevMode.ts`
- Goals: navigate, follow_objective, engage_enemies, advance_dialogue, complete_tutorial

#### SQLite Web/Native Split
Dual SQLite implementation for cross-platform persistence:
- **Native (iOS/Android)**: `src/game/db/CapacitorDatabase.ts` - Uses @capacitor-community/sqlite
- **Web**: `src/game/db/WebSQLiteDatabase.ts` - Uses sql.js with IndexedDB persistence
- Singleton initialization with race condition protection
- Platform detection via `Capacitor.isNativePlatform()`

#### Leaderboard System
Local leaderboards stored in SQLite:
- Location: `src/game/social/LeaderboardSystem.ts`
- Per-level and global campaign leaderboards
- Categories: speedrun, high score, accuracy, kills
- Top 100 entries per category
- Personal best tracking with difficulty filtering
- UI: `src/components/ui/LeaderboardScreen.tsx`

#### Internationalization (i18n)
Multi-language support:
- Location: `src/i18n/`
- Core: `i18n.ts` - translation functions, language management
- React hooks: `useTranslation.ts` - component integration
- Language selector UI: `src/components/ui/LanguageSelector.tsx`

#### Game Mode Manager
Unified modifier system for different game modes:
- Location: `src/game/modes/GameModeManager.ts`
- Modes: normal, new_game_plus, arcade, survival
- Coordinates: NewGamePlus tiers, Skull modifiers, Difficulty settings
- Combined modifiers affect enemies, player, resources, gameplay flags

### Build Status
- **TypeScript**: Zero errors
- **Production build**: Passes (1185 assets precached)
- **Tests**: 94 files pass, 4,659 tests passed

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

## Active Decisions
- **Package Manager**: PNPM exclusively (never npm/npx)
- **Quest System**: Main quests auto-activate, branch quests from objects/NPCs
- **No Skip Tutorial**: Linear campaign, unlock levels by completion
- **Immersive Storytelling**: No popups, controls learned in-game
- **Save Format**: v5 with quest chain persistence
- **Difficulty**: 5 levels with optional permadeath toggle
- **SQLite Strategy**: Web uses sql.js, native uses Capacitor plugin

## Key Files to Watch
| File | Purpose |
|------|---------|
| `src/game/core/DifficultySettings.ts` | ULTRA-NIGHTMARE and permadeath |
| `src/game/systems/PlayerGovernor.ts` | Autonomous player control |
| `src/game/db/CapacitorDatabase.ts` | Native SQLite persistence |
| `src/game/db/WebSQLiteDatabase.ts` | Web SQLite persistence |
| `src/game/social/LeaderboardSystem.ts` | Local leaderboards |
| `src/i18n/i18n.ts` | Internationalization core |
| `src/game/modes/GameModeManager.ts` | Game mode modifiers |

## Next Steps
1. Final production testing
2. Mobile app store submissions
3. Performance profiling on target devices
4. User feedback integration
