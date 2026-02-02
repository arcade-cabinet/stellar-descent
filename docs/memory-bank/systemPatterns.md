# System Patterns

## System Overview
The application follows a strict hierarchical flow:
`App.tsx` -> `GameCanvas.tsx` -> `Level` (ILevel implementations) -> Systems

## Core Architecture

### Entry Point
- **App.tsx**: Provider hierarchy: `KeybindingsProvider` -> `GameProvider` -> `WeaponProvider` -> `GameUI`
- **GameCanvas.tsx**: React component hosting BabylonJS canvas and coordinating levels

### Context Providers
```
KeybindingsProvider (controls config)
  └─ GameProvider (game state)
      └─ WeaponProvider (weapon state)
          └─ GameUI (main component)
```

### Level System
- **ILevel Interface**: All levels implement standard lifecycle:
  - `initialize()`: Setup scene, assets, entities
  - `update(deltaTime)`: Frame update logic
  - `dispose()`: Cleanup resources
- **LevelConfig**: Metadata per level (chapter, act, spawn, music tracks)
- **LevelCallbacks**: Events from level to game (onCommsMessage, onKill, etc.)
- **Campaign Structure**: Linked list via `nextLevelId`/`previousLevelId`

### Entity Component System (ECS)
- **Library**: Miniplex
- **Usage**: All game objects are entities with data components
- **Queries**: `world.with('ai', 'transform')` for system processing
- **Components**: Transform, Health, Velocity, AI, Weapon, etc.

### AI System
- **Library**: Yuka
- **Pattern**: Finite State Machine (FSM)
- **States**: Idle, Patrol, Chase, Attack, Flee, Support
- **Behaviors**: Wander, Seek, Pursuit, Flee, Arrive

### World Generation
- **Chunk System**: 100x100 unit chunks
- **Procedural**: Deterministic generation from coordinates + seed
- **Persistence**: SQL.js stores chunk state locally

## Data Flow

### Input Flow
1. Keyboard/Touch -> `KeybindingsContext` (mapping)
2. Mapped actions -> Level's input handler
3. Handler -> Player entity updates

### Game Loop
1. `requestAnimationFrame` -> Level's `update(deltaTime)`
2. Level updates: AI, Physics, Combat, Spawning
3. BabylonJS renders scene

### State Communication
- **Level -> Game**: Via `LevelCallbacks` (onKill, onDamage, onCommsMessage)
- **Game -> UI**: Via `GameContext` (health, kills, objectives)
- **UI -> Level**: Via touch input / action triggers

## Key Patterns

### Ref-Based Updates
```typescript
// Avoid stale closures in RAF loops
const playerHealthRef = useRef(playerHealth);
useEffect(() => { playerHealthRef.current = playerHealth; }, [playerHealth]);
```

### Level Lifecycle
```typescript
// Level initialization pattern
async initialize() {
  await this.setupScene();
  await this.loadAssets();
  this.setupPlayer();
  this.setupEnemies();
  this.startGameLoop();
}
```

### Action Button System
- Levels can register dynamic action buttons via `onActionGroupsChange`
- Handlers registered via `onActionHandlerRegister`
- UI triggers actions via `triggerAction(actionId)`

### HUD Visibility
- Progressive unlocking during tutorial
- `setHUDVisibility({ healthBar: true, crosshair: true })`
- Default is all visible, tutorial starts minimal

## File Organization

### Level Structure
```
src/game/levels/{level-name}/
├── index.ts              # Exports
├── {LevelName}Level.ts   # Main level class
├── environment.ts        # Mesh/scene setup
├── enemies.ts           # Enemy spawning/AI
├── materials.ts         # Textures/materials
└── {LevelName}Level.module.css  # Styles
```

### Context Structure
```
src/game/context/
├── GameContext.tsx       # Main game state
├── KeybindingsContext.tsx # Control bindings
└── WeaponContext.tsx     # Weapon state
```

### Component Structure
```
src/components/
├── GameCanvas.tsx        # Main 3D canvas
└── ui/
    ├── HUD.tsx           # In-game overlay
    ├── MainMenu.tsx      # Title screen
    ├── SettingsMenu.tsx  # Keybindings UI
    ├── DeathScreen.tsx   # Game over
    ├── TouchControls.tsx # Mobile input
    └── CommsDisplay.tsx  # Dialogue system
```

### Asset Structure
```
public/assets/
├── models/               # GLB 3D models
├── textures/             # Texture files
├── audio/                # Sound effects and music
└── videos/
    └── splash/           # Splash screen videos
        ├── main_16x9.mp4
        ├── main_9x16.mp4
        └── manifest.json # Generation manifest
```

## GenAI Asset Generation

### Manifest-Driven Generation
Assets are generated via manifests that define generation parameters:
```typescript
// Example manifest structure
{
  "assets": [{
    "name": "main",
    "prompt": "...",
    "aspectRatios": ["16:9", "9:16"],
    "duration": 8,
    "resolution": "1080p"
  }]
}
```

### Schema Validation
- **GenerationManifestSchemas.ts**: Defines Zod schemas for generation manifests
- **AssetManifestSchemas.ts**: Defines Zod schemas for asset metadata

### Generation Flow
1. Manifest parsed with Zod validation
2. API calls to Gemini 3 Pro (images) or Veo 3.1 (videos)
3. Assets saved alongside manifest
4. VCR recordings saved for CI replay

### VCR Testing with Polly.JS
Deterministic CI testing via recorded API responses:
- Records live API responses during development
- Replays recordings in CI for deterministic tests
- Avoids flaky tests and API rate limits

## Rendering Safety Patterns

### PBR Material Observer (Global Alpha=0 Fix)
All levels inherit from BaseLevel, which adds a global material observer in its constructor:
```typescript
// BaseLevel constructor
this.scene.onNewMaterialAddedObservable.add((material) => {
  if ('metallic' in material && 'roughness' in material && material.alpha === 0) {
    material.alpha = 1;
    material.transparencyMode = 0; // OPAQUE
  }
});
```
**Why**: GLTF models with `baseColorFactor[3]=0` and `alphaMode:"MASK"` cause BabylonJS to set alpha=0, making all fragments invisible.

### Static Shader Imports (Vite+pnpm Fix)
BaseLevel statically imports all critical shader modules to prevent ShaderStore duplication:
```typescript
// Must be static imports, NOT dynamic
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Shaders/pbr.vertex';
import '@babylonjs/core/Shaders/pbr.fragment';
import '@babylonjs/core/Shaders/glowMapGeneration.vertex';
import '@babylonjs/core/Shaders/glowMapGeneration.fragment';
```
**Why**: Vite+pnpm can resolve dynamic BabylonJS imports to a different module instance, causing shaders to register in the wrong `ShaderStore`.

### Vite Shader Guard Plugin
`vite.config.ts` includes `babylonShaderGuardPlugin()` that intercepts `.fragment`/`.vertex`/`.fx` HTTP requests and returns 404 instead of SPA fallback HTML.
**Why**: Without this, BabylonJS tries to compile `index.html` as GLSL, causing "SHADER ERROR: '<' : syntax error".

### CinematicSystem Lifecycle
The cinematic system manages fade overlays and letterbox bars. Critical lifecycle rules:
1. `completeSequence()` MUST hide both letterbox bars AND fadeOverlay
2. All `setTimeout` calls MUST be tracked in `pendingTimeouts` for cleanup on dispose
3. `dispose()` and `emergencyCleanup()` clear all pending timeouts

### COOP/COEP Headers
Only enabled in production mode. Dev mode omits them because:
- Game doesn't use SharedArrayBuffer (no Havok physics WASM)
- They block Chrome extension content scripts needed for testing

## Difficulty System

### DifficultySettings Pattern
Centralized difficulty configuration with type-safe presets:
```typescript
type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'nightmare' | 'ultra_nightmare';

interface DifficultyModifiers {
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
  playerDamageReceivedMultiplier: number;
  playerHealthRegenMultiplier: number;
  forcesPermadeath: boolean;
  // ... more modifiers
}
```

### ULTRA-NIGHTMARE Mode
Extreme difficulty with forced permadeath:
- 2.0x enemy health, 2.5x enemy damage
- No health regeneration (0.0 multiplier)
- One death ends entire campaign
- 2.0x XP reward

### Permadeath Toggle
Optional permadeath mode for any difficulty:
- Stored in localStorage (`stellar_descent_permadeath`)
- +50% XP bonus when enabled
- ULTRA-NIGHTMARE always forces permadeath

### DifficultyManager Singleton
```typescript
const manager = getDifficultyManager();
manager.getDifficulty();
manager.setDifficulty('nightmare');
manager.scaleHealth(100);  // Returns scaled enemy health
manager.addListener((newDiff, oldDiff) => { /* react */ });
```

## Database Pattern

### Platform-Aware SQLite
Two implementations with unified interface:

**CapacitorDatabase** (Native)
- Uses @capacitor-community/sqlite
- jeep-sqlite web component for web fallback
- Supports encryption on native

**WebSQLiteDatabase** (Web)
- Uses sql.js (compiled SQLite)
- IndexedDB backing for persistence
- WASM loaded from `/assets/sql-wasm.js`

### Singleton Initialization
```typescript
// Both databases use singleton init promise to prevent race conditions
private static initPromise: Promise<void> | null = null;

async init(): Promise<void> {
  if (this.initialized) return;
  if (CapacitorDatabase.initPromise) {
    return CapacitorDatabase.initPromise;
  }
  CapacitorDatabase.initPromise = this.doInit();
  // ...
}
```

### Database Reset Lifecycle (Critical Pattern)
When resetting the database (e.g., NEW GAME), three singletons must be cleared:
1. **DatabaseProxy** (`database.ts`): `dbInstance` and `initPromise` must be nulled in both `close()` and `deleteDatabase()`, or `getDatabase()` returns a stale closed instance.
2. **WorldDatabase** (`worldDatabase.ts`): `WorldDatabase.initPromise` must be nulled in `resetDatabase()`, or `init()` returns the stale resolved promise and skips `createTables()`.
3. **WebSQLiteDatabase**: `close()` sets internal `db = null` — this is correct, but callers must not retain references.

```typescript
// DatabaseProxy.deleteDatabase() - MUST clear singleton
async deleteDatabase(): Promise<void> {
  const db = await this.getDb();
  await db.deleteDatabase();
  dbInstance = null;    // Clear so getDatabase() creates fresh instance
  initPromise = null;
}

// WorldDatabase.resetDatabase() - MUST clear static promise
async resetDatabase(): Promise<void> {
  await capacitorDb.deleteDatabase();
  this.initialized = false;
  WorldDatabase.initPromise = null;  // Force init() to re-run doInit()
  await this.init();
}
```

### Audio Loading Safety Pattern
Tone.js has a global `Tone.loaded()` promise that waits for ALL buffers. A single failed buffer poisons ALL subsequent `Tone.loaded()` calls. Two mitigations:

1. **Pre-validate audio files** before creating Tone.Player:
```typescript
const headResp = await fetch(audioPath, { method: 'HEAD' });
const contentType = headResp.headers.get('content-type') || '';
if (!contentType.startsWith('audio/')) {
  log.warn('Audio file not available', { path: audioPath, contentType });
  return; // Don't create player - would poison Tone.loaded()
}
```

2. **Per-player load promises** instead of global `Tone.loaded()`:
```typescript
const newPlayer = await new Promise<Tone.Player>((resolve, reject) => {
  const player = new Tone.Player({
    url: path, loop: true,
    onload: () => resolve(player),
    onerror: (err) => reject(err),
  });
});
// NOT: await Tone.loaded(); // Poisoned by ANY failed buffer
```

## Player Governor (Dev Mode)

### Autonomous Player Control
Uses Yuka AI for automated testing:
```typescript
const governor = getPlayerGovernor();
governor.setPlayer(playerEntity);
governor.setGoal({ type: 'navigate', target: position });
governor.setGoal({ type: 'engage_enemies', aggressive: true });
governor.setGoal({ type: 'complete_tutorial' });
```

### Goal Queue
Goals can be queued for sequential execution:
```typescript
governor.queueGoal({ type: 'wait', duration: 2000 });
governor.queueGoal({ type: 'advance_dialogue' });
governor.queueGoal({ type: 'follow_objective' });
```

### DevMenu Integration
Toggle "Player Governor (Unlock All)" enables `devMode.allLevelsUnlocked`

## Leaderboard System

### Local Leaderboards
```
src/game/social/
├── LeaderboardSystem.ts   # Core leaderboard logic
├── LeaderboardTypes.ts    # Type definitions
└── index.ts
```

### Categories
- **speedrun**: Lower time is better
- **score**: Total performance score
- **accuracy**: Shot accuracy percentage
- **kills**: Total enemies killed

### Query Pattern
```typescript
const results = await leaderboardSystem.getLeaderboard({
  levelId: 'landfall',
  type: 'speedrun',
  difficulty: 'nightmare',
  limit: 10,
});
```

## Internationalization (i18n)

### Translation System
```typescript
import { t, setLanguage } from '../i18n';

// Use translations
const text = t('menu.new_game');

// Change language
setLanguage('es');

// React hook
const { t, language } = useTranslation();
```

### Language Management
- Supports multiple languages via `SUPPORTED_LANGUAGES`
- Language stored in localStorage
- React components re-render on language change via `onLanguageChange()`
