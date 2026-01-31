# Technical Architecture

This document describes the technical architecture of STELLAR DESCENT: PROXIMA BREACH, including system design, data flow, and implementation details.

## System Overview

```text
+-----------------------------------------------------------------------+
|                         App.tsx (Entry)                                |
|  - React app root                                                      |
|  - GameProvider context wrapper                                        |
|  - Route management (menu, game, settings)                             |
+-----------------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------------+
|                      GameProvider                                      |
|  +-------------------+  +-------------------+  +-------------------+   |
|  | PlayerProvider    |  | MissionProvider   |  | CombatProvider    |   |
|  | - Health state    |  | - Objectives      |  | - Kill tracking   |   |
|  | - Death handling  |  | - Comms messages  |  | - Combat state    |   |
|  | - Difficulty      |  | - Chapters        |  | - Music triggers  |   |
|  | - HUD visibility  |  | - Notifications   |  | - Damage events   |   |
|  +-------------------+  +-------------------+  +-------------------+   |
+-----------------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------------+
|                      GameCanvas.tsx                                    |
|  - Engine initialization (WebGL2)                                      |
|  - Level management                                                    |
|  - Render loop                                                         |
|  - Touch input handling                                                |
+-----------------------------------------------------------------------+
                                |
        +-----------------------+-----------------------+
        v                       v                       v
+---------------+     +-------------------+     +-------------------+
|    Levels     |     |   SaveSystem      |     |   UI Systems      |
| - BaseLevel   |     | - Persistence     |     | - HUD             |
| - Factories   |     | - Migrations      |     | - Menus           |
| - Transitions |     | - Best times      |     | - Touch controls  |
+---------------+     +-------------------+     +-------------------+
        |                       |
        v                       v
+-----------------------------------------------------------------------+
|                    Entity Component System                             |
|  - Miniplex World                                                     |
|  - Entity queries                                                      |
|  - Component storage                                                   |
+-----------------------------------------------------------------------+
        |                       |
        v                       v
+---------------+     +-------------------+
|   AISystem    |     |  CombatSystem     |
| - Yuka        |     | - Projectiles     |
| - Behaviors   |     | - Damage          |
| - States      |     | - Deaths          |
+---------------+     +-------------------+
```

## CampaignDirector (Game State Machine)

The CampaignDirector is the game's central nervous system. Located at `src/game/campaign/CampaignDirector.ts`, it:

1. **Manages Campaign State**: Tracks phase, level, kills, time, difficulty
2. **Handles Commands**: All state mutations go through `dispatch(command)`
3. **Wires Systems**: Connects achievements, dialogue, collectibles
4. **React Integration**: Implements `subscribe/getSnapshot` for `useSyncExternalStore`

### Campaign Phases
```text
idle → splash → menu
                  ↓
             ←── loading ←── briefing ←── intro
                  ↓
             tutorial / dropping / playing
                  ↓
             levelComplete → (ADVANCE) → loading (next level)
                  ↓
             credits → menu
```

### Command Types
| Command | Description |
|---------|-------------|
| `NEW_GAME` | Start new campaign with difficulty and start level |
| `CONTINUE` | Resume from save |
| `SELECT_LEVEL` | Jump to specific level (mission select) |
| `LOADING_COMPLETE` | Level finished loading |
| `LEVEL_COMPLETE` | Player completed level |
| `ADVANCE` | Proceed to next level |
| `RETRY` | Restart current level |
| `PAUSE` / `RESUME` | Pause state management |
| `PLAYER_DIED` | Death handling |
| `MAIN_MENU` | Return to menu |

### Usage
```typescript
import { useCampaign } from './game/campaign/useCampaign';

function MyComponent() {
  const [snapshot, dispatch] = useCampaign();

  // Read state
  const { phase, currentLevelId, completionStats } = snapshot;

  // Dispatch commands
  dispatch({ type: 'NEW_GAME', difficulty: 'normal', startLevel: 'landfall' });
  dispatch({ type: 'PAUSE' });
}
```

## Core Technologies

### Rendering: BabylonJS 8.x

**Engine Selection**
```typescript
// WebGL2 only - no fallbacks, fail fast
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
});
```

**Why No WebGPU?**
WebGPU support is still inconsistent. Silent fallbacks hide real errors and make debugging harder. We use WebGL2 which works everywhere.

**Post-Processing Pipeline**
```typescript
const pipeline = new DefaultRenderingPipeline();
pipeline.imageProcessing.contrast = 1.5;      // High contrast
pipeline.imageProcessing.exposure = 1.15;     // Bright
pipeline.imageProcessing.toneMappingType = 1; // ACES
pipeline.bloomEnabled = true;                  // Bloom for HDR
pipeline.bloomThreshold = 0.75;
pipeline.chromaticAberrationEnabled = true;   // Visor effect
```

### Physics: Havok

```typescript
const hk = await HavokPhysics();
const plugin = new HavokPlugin(true, hk);
scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
```

Physics bodies are created for:
- Ground plane (static)
- Rock formations (static)
- Buildings (static)
- Player (kinematic - controlled by code)

### AI: Yuka

**Steering Behaviors Used**
- `WanderBehavior` - Patrol state
- `SeekBehavior` - Chase state
- `PursuitBehavior` - Attack state
- `FleeBehavior` - Low health retreat
- `ArriveBehavior` - Ally positioning

**State Machine**
```text
          +---------+
          |  IDLE   |
          +----+----+
               | player in alertRadius
               v
          +---------+
          | PATROL  |<------------------+
          +----+----+                   |
               | player in alertRadius  |
               v                        |
          +---------+                   |
          |  CHASE  |-------------------+
          +----+----+ player escaped    |
               | player in attackRadius |
               v                        |
          +---------+                   |
          | ATTACK  |-------------------+
          +----+----+ player escaped    |
               | health < 20%           |
               v                        |
          +---------+                   |
          |  FLEE   |-------------------+
          +---------+ health recovered
```

## React Context Architecture

The game state is split across three focused contexts for better performance and separation of concerns:

### PlayerContext
```typescript
interface PlayerContextType {
  health: number;
  maxHealth: number;
  isDead: boolean;
  difficulty: DifficultyLevel;
  hudVisibility: HUDVisibility;
  touchInput: TouchInputState | null;

  // Actions
  setHealth: (health: number) => void;
  takeDamage: (amount: number) => void;
  die: () => void;
  respawn: () => void;
  setDifficulty: (difficulty: DifficultyLevel) => void;
  setTouchInput: (input: TouchInputState | null) => void;
}
```

### CombatContext
```typescript
interface CombatContextType {
  kills: number;
  inCombat: boolean;
  hitMarker: HitMarkerState | null;
  directionalDamage: DirectionalDamageState | null;

  // Actions
  addKill: () => void;
  setInCombat: (inCombat: boolean) => void;
  showHitMarker: (damage: number, isCritical: boolean) => void;
  showDirectionalDamage: (angle: number, damage: number) => void;
}
```

### MissionContext
```typescript
interface MissionContextType {
  currentChapter: number;
  currentObjective: ObjectiveState | null;
  commsMessage: CommsMessage | null;
  notifications: NotificationState[];
  objectiveMarkers: ObjectiveMarker[];

  // Actions
  setChapter: (chapter: number) => void;
  setObjective: (title: string, instructions: string) => void;
  showComms: (message: CommsMessage) => void;
  hideComms: () => void;
  notify: (text: string, duration?: number) => void;
}
```

### Unified Facade
```typescript
// For backward compatibility, useGame() combines all contexts
function useGame() {
  const player = usePlayer();
  const combat = useCombat();
  const mission = useMission();
  return { ...player, ...combat, ...mission };
}
```

## Level System Architecture

### Level Structure
```text
src/game/levels/
├── BaseLevel.ts          # Abstract base class
├── types.ts              # Level types, configs, CAMPAIGN_LEVELS
├── factories.ts          # Factory registry
├── LevelManager.ts       # Level lifecycle management
├── anchor-station/       # Tutorial level
│   ├── index.ts
│   ├── AnchorStationLevel.ts
│   ├── TutorialManager.ts
│   ├── tutorialSteps.ts
│   └── environment.ts
├── landfall/             # HALO drop level
├── canyon-run/           # Vehicle chase
├── fob-delta/            # Horror investigation
├── brothers-in-arms/     # Mech combat
├── southern-ice/         # Ice level
├── the-breach/           # Queen boss fight
├── hive-assault/         # Combined arms
├── extraction/           # Wave holdout
└── final-escape/         # Vehicle finale
```

### Linked List Navigation
```typescript
// Levels form a doubly-linked list
const CAMPAIGN_LEVELS: Record<LevelId, LevelConfig> = {
  anchor_station: {
    nextLevelId: 'landfall',
    previousLevelId: null,
    // ...
  },
  landfall: {
    nextLevelId: 'canyon_run',
    previousLevelId: 'anchor_station',
    // ...
  },
  // ... continues for all 10 levels
  final_escape: {
    nextLevelId: null,  // End of campaign
    previousLevelId: 'extraction',
    // ...
  },
};
```

### Level Factory Pattern
```typescript
// Each level type has a factory function
type LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
) => ILevel;

// Factories are registered by level type
const factories: Partial<LevelFactoryRegistry> = {
  station: createAnchorStationLevel,
  drop: createLandfallLevel,
  vehicle: createCanyonRunLevel,
  // ...
};
```

### Level Lifecycle
```text
Level Requested
      |
      v
Factory.create(config)
      |
      v
level.initialize()
  - Create scene
  - Load assets
  - Setup environment
      |
      v
level.update(deltaTime)  <- Game loop
  - Update player
  - Update enemies
  - Check objectives
      |
      v
level.prepareTransition(nextLevelId)
  - Fade out
  - Save state
      |
      v
level.dispose()
  - Cleanup scene
  - Release resources
```

## Quest Chain System

The quest chain wires all 10 campaign levels together with main quests and optional branch quests.

### Architecture
```text
src/game/campaign/
├── QuestChain.ts       # Quest definitions (main + branch)
├── QuestManager.ts     # Runtime quest state management
└── types.ts            # CampaignCommand, CampaignPhase, etc.
```

### Quest Types
| Type | Description | Trigger |
|------|-------------|---------|
| `main` | Campaign progression quests (one per level) | Auto on level enter |
| `branch` | Optional side content | Object/NPC interaction |
| `secret` | Hidden quests for completionists | Area discovery |

### Main Quest Chain
Each level has exactly one main quest that drives progression:
```text
anchor_station → landfall → canyon_run → fob_delta → brothers_in_arms
                                                           ↓
final_escape ← extraction ← hive_assault ← the_breach ← southern_ice
```

### Quest Structure
```typescript
interface QuestDefinition {
  id: string;
  type: 'main' | 'branch' | 'secret';
  levelId: LevelId;
  name: string;
  description: string;

  objectives: QuestObjective[];

  triggerType: 'level_enter' | 'object_interact' | 'npc_dialogue' | 'area_enter';
  triggerData?: { objectId?: string; npcId?: string; areaId?: string };

  prerequisites?: { quests?: string[]; levels?: LevelId[]; items?: string[] };
  rewards?: { unlockArea?: string; giveItem?: string; achievement?: string };

  branchQuests?: string[];  // Optional quests this unlocks
  nextQuestId?: string;     // Next main quest in chain
}
```

### Objective Types
| Type | Description | Progress |
|------|-------------|----------|
| `reach_location` | Go to waypoint | Position check |
| `interact` | Use object/terminal | Callback |
| `kill_enemies` | Defeat count | Increment |
| `kill_target` | Defeat specific enemy | Boolean |
| `survive` | Survive duration | Timer |
| `escort` | Keep NPC alive | NPC health |
| `collect` | Find items | Increment |
| `defend` | Protect location | Timer + enemies |
| `vehicle` | Drive to destination | Position |

### Quest Manager API
```typescript
import {
  initializeQuestManager,
  onLevelEnter,
  onObjectInteract,
  onEnemyKilled,
  completeObjective,
  getActiveMainQuest,
} from './game/campaign/QuestManager';

// Initialize with callbacks
initializeQuestManager({
  onObjectiveUpdate: (title, instructions) => { /* HUD update */ },
  onObjectiveMarker: (position, label) => { /* Compass marker */ },
  onDialogueTrigger: (trigger) => { /* Reyes dialogue */ },
  onNotification: (text, duration) => { /* Toast notification */ },
});

// Level enter auto-activates main quest
onLevelEnter('landfall', completedLevels, inventory);

// Triggers from game events
onObjectInteract('locker_personal', 'anchor_station', completedLevels, inventory);
onEnemyKilled('chitin');

// Manual objective completion
completeObjective('main_landfall', 'landfall_combat');
```

### Branch Quest Discovery
Branch quests are found organically in-world:

| Trigger | Example |
|---------|---------|
| Object interaction | Read Marcus's letter in locker |
| NPC dialogue | Talk to Marcus about fallen squad |
| Area entry | Discover hidden observation deck |
| Collectible found | Finding VANGUARD team logs |

### Persistence
Quest state is saved in GameSave:
```typescript
interface GameSave {
  completedQuests: string[];
  activeQuests: Record<string, QuestState>;
  failedQuests: string[];
}
```

## Save System

### Architecture
```typescript
class SaveSystem {
  private currentSave: GameSave | null;
  private sessionStartTime: number;

  // Lifecycle
  async initialize(): Promise<void>;
  async newGame(difficulty?: DifficultyLevel, startLevel?: LevelId): Promise<GameSave>;
  async loadGame(): Promise<GameSave | null>;
  save(): void;
  autoSave(): void;

  // Progress tracking
  setCurrentLevel(levelId: LevelId): void;
  completeLevel(levelId: LevelId): void;
  recordLevelTime(levelId: LevelId, seconds: number): boolean;

  // Stats
  addKill(): void;
  addDistance(distance: number): void;
}
```

**Note:** `newGame()` accepts an optional `startLevel` parameter. If provided:
- Save starts at that level instead of `anchor_station`
- Chapter is set based on level config
- Tutorial is marked as completed if starting past `anchor_station`

### Save Format (v5)
```typescript
interface GameSave {
  id: string;
  version: 5;
  timestamp: number;
  name: string;

  // Progress
  currentLevel: LevelId;
  currentChapter: number;
  levelsCompleted: LevelId[];
  levelsVisited: LevelId[];
  levelBestTimes: Partial<Record<LevelId, number>>;

  // Player state
  playerHealth: number;
  maxPlayerHealth: number;
  playerPosition: { x: number; y: number; z: number };
  playerRotation: number;

  // Stats
  totalKills: number;
  totalDistance: number;
  playTime: number;

  // Settings
  difficulty: DifficultyLevel;
  seenIntroBriefing: boolean;

  // Inventory
  inventory: Record<string, number>;
  levelFlags: Record<LevelId, Record<string, boolean>>;

  // Quest Chain (v5)
  completedQuests: string[];
  activeQuests: Record<string, QuestState>;
  failedQuests: string[];

  // @deprecated - use completedQuests/activeQuests instead
  objectives: Record<string, boolean>;
  tutorialCompleted: boolean;
}
```

### Migration System
```typescript
private migrateSave(save: GameSave): void {
  // v1 -> v2: Add difficulty
  if (save.version < 2) {
    save.difficulty = 'normal';
  }

  // v2 -> v3: Add seenIntroBriefing
  if (save.version < 3) {
    save.seenIntroBriefing = false;
  }

  // v3 -> v4: Add levelBestTimes
  if (save.version < 4) {
    save.levelBestTimes = {};
  }

  // v4 -> v5: Add quest chain state
  if (save.version < 5) {
    save.completedQuests = [];
    save.activeQuests = {};
    save.failedQuests = [];

    // Migrate old objectives to completedQuests
    if (save.objectives) {
      for (const [questId, completed] of Object.entries(save.objectives)) {
        if (completed) save.completedQuests.push(questId);
      }
    }
  }

  save.version = SAVE_FORMAT_VERSION;
}
```

### Storage
- **Primary**: SQLite (sql.js on web, Capacitor SQLite on native)
- **Key format**: `save_{saveId}`
- **PWA support**: IndexedDB backing for web persistence

## Difficulty System

### Five Difficulty Levels
```typescript
type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'nightmare' | 'ultra_nightmare';
```

| Level | Enemy HP | Enemy Damage | XP Bonus | Notes |
|-------|----------|--------------|----------|-------|
| Easy | 0.625x | 0.625x | 0.75x | Story mode |
| Normal | 1.0x | 1.0x | 1.0x | Default |
| Hard | 1.25x | 1.39x | 1.25x | +25% XP |
| Nightmare | 1.625x | 1.95x | 1.5x | +50% XP |
| ULTRA-NIGHTMARE | 2.0x | 2.5x | 2.0x | Forced permadeath |

### Permadeath System
- Optional toggle for any difficulty (+50% XP bonus)
- ULTRA-NIGHTMARE always forces permadeath
- One death ends the entire campaign run
- Stored in localStorage (`stellar_descent_permadeath`)

### DifficultyManager Singleton
```typescript
import { getDifficultyManager } from './game/core/DifficultySettings';

const manager = getDifficultyManager();

// Query
manager.getDifficulty();
manager.getModifiers();

// Scale values
manager.scaleHealth(100);
manager.scaleDamage(50);
manager.scaleXP(100);

// Listen for changes
manager.addListener((newDiff, oldDiff) => {
  console.log(`Difficulty changed: ${oldDiff} -> ${newDiff}`);
});
```

## Database Layer

### Platform-Aware SQLite
Two implementations with identical interface:

**CapacitorDatabase** (Native iOS/Android)
```typescript
// Uses @capacitor-community/sqlite
// Supports encryption
// Direct native SQLite access
```

**WebSQLiteDatabase** (Browser)
```typescript
// Uses sql.js (compiled SQLite to WASM)
// IndexedDB backing for persistence
// WASM loaded from /assets/sql-wasm.js
```

### Unified API
```typescript
import { capacitorDb } from './game/db/database';

await capacitorDb.init();
await capacitorDb.run('INSERT INTO ...', [params]);
const results = await capacitorDb.query<T>('SELECT ...', [params]);
await capacitorDb.persist(); // Web only - save to IndexedDB
```

## Leaderboard System

Local leaderboards stored in SQLite:
```typescript
import { getLeaderboardSystem } from './game/social';

const lb = getLeaderboardSystem();

// Submit score
await lb.submitScore({
  levelId: 'landfall',
  completionTime: 145.7,
  totalScore: 15000,
  accuracy: 0.85,
  enemiesKilled: 47,
  difficulty: 'nightmare',
});

// Query leaderboard
const results = await lb.getLeaderboard({
  levelId: 'landfall',
  type: 'speedrun', // or 'score', 'accuracy', 'kills'
  difficulty: 'nightmare',
  limit: 10,
});
```

## Entity Component System

### World Definition
```typescript
import { World } from 'miniplex';

interface Entity {
  id: string;
  transform?: Transform;
  health?: Health;
  velocity?: Velocity;
  combat?: Combat;
  ai?: AIComponent;
  renderable?: Renderable;
  tags?: Tags;
  chunkInfo?: ChunkInfo;
  lifetime?: LifeTime;
  alienInfo?: AlienInfo;
}

const world = new World<Entity>();
```

### Component Types

**Transform**
```typescript
interface Transform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}
```

**Health**
```typescript
interface Health {
  current: number;
  max: number;
  regenRate: number;
}
```

**Combat**
```typescript
interface Combat {
  damage: number;
  range: number;
  fireRate: number;
  lastFire: number;
  projectileSpeed: number;
}
```

**AI**
```typescript
interface AIComponent {
  vehicle: Vehicle;        // Yuka vehicle
  behaviors: SteeringBehavior[];
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'support';
  target: Entity | null;
  alertRadius: number;
  attackRadius: number;
}
```

**AlienInfo** (new in Phase 4)
```typescript
interface AlienInfo {
  speciesId: string;       // e.g., 'STRAIN-X1'
  seed: number;            // Procedural generation seed
  xpValue: number;         // Experience on kill
  lootTable: string;       // Loot table ID
}
```

### Queries
```typescript
const queries = {
  players: world.with('tags', 'transform', 'health', 'velocity', 'combat'),
  enemies: world.with('tags', 'transform', 'health', 'ai', 'renderable'),
  allies: world.with('tags', 'transform', 'health', 'ai', 'renderable'),
  projectiles: world.with('tags', 'transform', 'velocity', 'lifetime'),
  aliens: world.with('alienInfo', 'transform', 'health'),
};
```

## Performance System

### PerformanceManager
```typescript
class PerformanceManager {
  // Quality levels: Ultra, High, Medium, Low, Potato
  setQuality(level: QualityLevel): void;

  // Dynamic adjustment
  update(): void;  // Called each frame

  // Platform detection
  getPlatformPreset(): QualityLevel;

  // Debug
  configure(options: { debugOverlay?: boolean }): void;
}
```

### Quality Levels
| Level | Resolution | Particles | Shadows | LOD | Target FPS |
|-------|------------|-----------|---------|-----|------------|
| Ultra | 100% | 100% | 4096px | 1.5x | 60 |
| High | 100% | 80% | 2048px | 1.0x | 60 |
| Medium | 90% | 50% | 1024px | 0.8x | 60 |
| Low | 75% | 30% | 512px | 0.6x | 30 |
| Potato | 50% | 15% | Off | 0.4x | 30 |

### Dynamic Resolution Scaling
```text
FPS < 25 for 30+ frames
  -> Reduce resolution by 15%
  -> Minimum: 50%

FPS > 55 for 60+ frames
  -> Increase resolution by 7.5%
  -> Maximum: preset resolution
```

## Input System

### Desktop Controls
```typescript
const keysPressed = new Set<string>();

window.addEventListener('keydown', (e) => {
  keysPressed.add(e.code);
});

window.addEventListener('keyup', (e) => {
  keysPressed.delete(e.code);
});

camera.attachControl(canvas, true);
```

### Touch Controls
```text
+-----------------------------------------------+
|                                               |
|                                               |
|  [MOVE]                            [FIRE]     |
|    O          (drag to look)          O       |
|                                    [JUMP]     |
|                                    [RUN]      |
+-----------------------------------------------+
```

### Input Normalization
```typescript
interface TouchInputState {
  movement: { x: number; y: number };  // -1 to 1
  look: { x: number; y: number };      // Delta for camera
  isFiring?: boolean;
  isSprinting?: boolean;
  isJumping?: boolean;
  isCrouching?: boolean;
}
```

## Procedural World Generation

### Chunk System
```typescript
const CHUNK_SIZE = 100;    // World units
const LOAD_RADIUS = 3;     // Chunks around player
const UNLOAD_RADIUS = 5;   // Unload beyond this
```

### Seeded Generation
```typescript
function generateChunkSeed(chunkX: number, chunkZ: number): number {
  return baseSeed + chunkX * 73856093 + chunkZ * 19349663;
}

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}
```

### Generation Pipeline
```text
1. Calculate chunk seed
2. Create seeded random generator
3. Generate building positions & types
4. Generate obstacle positions & types
5. Generate enemy spawn points
6. Create meshes
7. Create entities
```

## Timer System

Two complementary timing systems serve different purposes:

### GameTimer (Real-World Timing)
For speedruns and play time tracking:
```typescript
import { getGameTimer, formatTimeMMSS } from './game/timer';

const timer = getGameTimer();

// Mission timing
timer.startMission('landfall');
timer.pause();
timer.resume();
const finalTime = timer.stopMission(); // Returns seconds

// Best times
timer.checkAndSaveBestTime('landfall', 145.7);
const best = timer.getBestTime('landfall');

// Formatting
formatTimeMMSS(145.7); // "02:25"
```

### GameChronometer (In-Universe Time)
For immersive display using lore year 3147:
```typescript
import { getGameChronometer } from './game/timer';

const chrono = getGameChronometer();

// Start/stop aligned with mission
chrono.startMission('landfall');
chrono.pause();
chrono.resume();

// Get formatted times
const snapshot = chrono.getSnapshot();
snapshot.formattedMissionTime;   // "02:25.847"
snapshot.formattedCampaignTime;  // "01:23:45"
snapshot.militaryTimestamp;      // "3147.08.17 // 14:35:22.847Z"
snapshot.loreDate;               // { year: 3147, month: 8, day: 17, ... }
```

**Key Differences:**
| Aspect | GameTimer | GameChronometer |
|--------|-----------|-----------------|
| Precision | Milliseconds | Microseconds |
| Base | Real time | Lore year 3147 |
| Purpose | Speedruns, stats | HUD display, immersion |
| Format | MM:SS | YYYY.MM.DD // HH:MM:SS.mmmZ |

## Logging System

Use `getLogger()` instead of `console.log`:
```typescript
import { getLogger } from './game/core/Logger';

const log = getLogger('MySystem');

log.trace('Detailed trace');  // Only in dev with trace level
log.debug('Debug info');      // Only in dev
log.info('Info message');     // Normal info
log.warn('Warning');          // Warnings
log.error('Error', error);    // Errors (always logged)

// Set log level at runtime
import { setLogLevel } from './game/core/Logger';
setLogLevel('debug');  // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
```

**Features:**
- Named loggers with `[Prefix]` format
- Log level control via localStorage (`stellar_log_level`)
- Production mode defaults to 'warn'
- Development mode defaults to 'debug'

## Audio System (Tone.js)

### Music Manager
```typescript
class MusicManager {
  // Tracks
  playAmbient(track: string): void;
  playCombat(track: string): void;
  playBoss(): void;

  // State-based switching
  setInCombat(inCombat: boolean): void;
  setChapter(chapter: number): void;
}
```

### Track Types
- `station_ambient` - Anchor Station interior
- `canyon_wind` - Surface exploration
- `horror_ambient` - FOB Delta
- `combat_surface` - Surface combat
- `combat_interior` - Indoor combat
- `combat_mech` - Brothers in Arms
- `boss_combat` - Queen fight
- `hive_ambient` - Underground
- `extraction_ambient` - LZ Omega
- `collapse_ambient` - Final escape

## Mobile/PWA Support

### Capacitor Integration
```typescript
// capacitor.config.ts
export default {
  appId: 'com.jbcom.stellardescent',
  appName: 'Stellar Descent',
  webDir: 'dist',
  plugins: {
    ScreenOrientation: {
      // Force landscape
    },
    SplashScreen: {
      // Auto-hide after load
    },
  },
};
```

### PWA Features
- Service worker for offline support
- App manifest for installation
- IndexedDB persistence for saves
- Responsive design (375px baseline)

## Testing Infrastructure

### Unit Tests (Vitest)
- **Location**: `src/**/*.test.{ts,tsx}`
- **Environment**: happy-dom
- **Coverage**: V8 provider

### E2E Tests (Maestro)
- **Location**: `.maestro/flows/*.yaml`
- **Platforms**: Web, iOS, Android
- **CI Integration**: GitHub Actions

## Weapon Feel Systems

Weapon feel ("game juice") makes weapons satisfying to use through coordinated visual and audio feedback.

> For detailed documentation, see [WEAPON-FEEL.md](./WEAPON-FEEL.md)

### Architecture Overview
```text
src/game/
├── weapons/
│   ├── FirstPersonWeapons.ts   # View model rendering + muzzle flash
│   ├── WeaponAnimations.ts     # Recoil, bob, sway, reload anims
│   └── index.ts
├── effects/
│   ├── MuzzleFlash.ts          # Flash sprites + point lights
│   ├── WeaponEffects.ts        # Shell casings, impact decals
│   └── ParticleManager.ts      # Pooled particle systems
└── core/
    └── WeaponSoundManager.ts   # Procedural weapon audio
```

### Key Systems

| System | Purpose | Key Features |
|--------|---------|--------------|
| Recoil | Camera/weapon kick | Per-weapon profiles, category defaults |
| Muzzle Flash | Visual flash | Pooled sprites, point lights, smoke |
| Screen Shake | Camera trauma | Damage-based intensity, configurable |
| Shell Casings | Ejected brass | Simple physics, auto-dispose |
| Weapon Sounds | Firing audio | 4 variations per weapon, reverb |

### Quick Start
```typescript
import { firstPersonWeapons } from './game/weapons/FirstPersonWeapons';
import { weaponSoundManager } from './game/core/WeaponSoundManager';

// Fire weapon (triggers recoil + muzzle flash)
firstPersonWeapons.fireWeapon();
weaponSoundManager.playWeaponFire('assault_rifle');
```

## Combat Feedback Systems

Combat feedback provides satisfying hit confirmation and enemy reactions.

> For detailed documentation, see [COMBAT-FEEDBACK.md](./COMBAT-FEEDBACK.md)

### Architecture Overview
```text
src/game/effects/
├── DamageFeedback.ts   # Hit flash, knockback, damage numbers
├── DeathEffects.ts     # Enemy death particles and dissolve
└── WeaponEffects.ts    # Hit VFX (blood/splatter)

src/game/core/
└── WeaponSoundManager.ts   # Hit/kill audio feedback
```

### Key Systems

| System | Purpose | Key Features |
|--------|---------|--------------|
| Hitmarker | Visual hit confirm | Flash + knockback + damage number |
| Hit Audio | Audio hit confirm | Hitmarker, headshot, kill sounds |
| Hit Reactions | Enemy flinch | Flash, scale punch, knockback |
| Death Effects | Enemy death | 6 effect types, mesh dissolve |
| Enemy Hit VFX | Blood/splatter | Alien (green) vs human (red) |

### Quick Start
```typescript
import { damageFeedback } from './game/effects/DamageFeedback';
import { deathEffects } from './game/effects/DeathEffects';
import { weaponSoundManager } from './game/core/WeaponSoundManager';

// On enemy hit
damageFeedback.applyDamageFeedback(enemyMesh, damage, hitDirection, isCritical);
weaponSoundManager.playHitMarker();

// On enemy death
deathEffects.playEnemyDeath(position, isAlien, scale, enemyMesh);
weaponSoundManager.playKillConfirmation();
```

### Death Effect Types
| Type | Visual | Use Case |
|------|--------|----------|
| `dissolve` | Fade to particles | Standard enemies |
| `disintegrate` | Fast with flash | Energy weapons |
| `explode` | Explosion + debris | Large enemies |
| `ichor_burst` | Green goo | Alien enemies |
| `mechanical` | Debris chunks | Robot enemies |
| `boss` | Epic with shockwave | Boss enemies |

---

*"Architecture is frozen music. But this is a shooter, so maybe more like frozen gunfire."*
