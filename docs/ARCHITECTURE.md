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

## Save System

### Architecture
```typescript
class SaveSystem {
  private currentSave: GameSave | null;
  private sessionStartTime: number;

  // Lifecycle
  async initialize(): Promise<void>;
  async newGame(difficulty?: DifficultyLevel): Promise<GameSave>;
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

### Save Format (v4)
```typescript
interface GameSave {
  id: string;
  version: 4;
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
  tutorialCompleted: boolean;
  seenIntroBriefing: boolean;

  // Inventory and objectives
  inventory: Record<string, number>;
  objectives: Record<string, boolean>;
  levelFlags: Record<LevelId, Record<string, boolean>>;
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

  save.version = SAVE_FORMAT_VERSION;
}
```

### Storage
- **Primary**: IndexedDB via worldDb
- **Key format**: `save_{saveId}`
- **PWA support**: Persisted for offline access

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

---

*"Architecture is frozen music. But this is a shooter, so maybe more like frozen gunfire."*
