# Technical Architecture

This document describes the technical architecture of STELLAR DESCENT: PROXIMA BREACH, including system design, data flow, and implementation details.

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                         App.ts (Entry)                         │
│  - Engine initialization (WebGPU/WebGL2)                       │
│  - Physics setup (Havok)                                       │
│  - Game loop                                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GameManager.ts                             │
│  - State management (menu, playing, paused)                    │
│  - System coordination                                          │
│  - Scene setup                                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Player     │     │   ChunkManager  │     │   UI Systems    │
│  - Controls   │     │  - Generation   │     │  - HUD          │
│  - Camera     │     │  - Loading      │     │  - Menu         │
│  - Shooting   │     │  - Persistence  │     │  - Touch        │
└───────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Entity Component System                      │
│  - Miniplex World                                              │
│  - Entity queries                                              │
│  - Component storage                                           │
└─────────────────────────────────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌───────────────┐     ┌─────────────────┐
│   AISystem    │     │  CombatSystem   │
│  - Yuka       │     │  - Projectiles  │
│  - Behaviors  │     │  - Damage       │
│  - States     │     │  - Deaths       │
└───────────────┘     └─────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WorldDatabase (SQL.js)                      │
│  - Chunk persistence                                           │
│  - Entity states                                               │
│  - Player stats                                                │
└─────────────────────────────────────────────────────────────────┘
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
          ┌─────────┐
          │  IDLE   │
          └────┬────┘
               │ player in alertRadius
               ▼
          ┌─────────┐
          │ PATROL  │◄────────────────┐
          └────┬────┘                 │
               │ player in alertRadius│
               ▼                      │
          ┌─────────┐                 │
          │  CHASE  │─────────────────┤
          └────┬────┘ player escaped  │
               │ player in attackRadius
               ▼                      │
          ┌─────────┐                 │
          │ ATTACK  │─────────────────┤
          └────┬────┘ player escaped  │
               │ health < 20%         │
               ▼                      │
          ┌─────────┐                 │
          │  FLEE   │─────────────────┘
          └─────────┘ health recovered
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

### Queries

```typescript
const queries = {
  players: world.with('tags', 'transform', 'health', 'velocity', 'combat'),
  enemies: world.with('tags', 'transform', 'health', 'ai', 'renderable'),
  allies: world.with('tags', 'transform', 'health', 'ai', 'renderable'),
  projectiles: world.with('tags', 'transform', 'velocity', 'lifetime'),
  renderables: world.with('transform', 'renderable'),
  withHealth: world.with('health'),
  withAI: world.with('ai', 'transform'),
};
```

## Procedural World Generation

### Chunk System

**Constants**
```typescript
const CHUNK_SIZE = 100;    // World units
const LOAD_RADIUS = 3;     // Chunks around player to load
const UNLOAD_RADIUS = 5;   // Chunks beyond this are unloaded
```

**Chunk Key**
```typescript
function getChunkKey(x: number, z: number): string {
  return `${x},${z}`;
}

function getChunkCoords(worldX: number, worldZ: number) {
  return {
    x: Math.floor(worldX / CHUNK_SIZE),
    z: Math.floor(worldZ / CHUNK_SIZE)
  };
}
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

This ensures:
- Same chunk coordinates always generate same content
- Chunks can be unloaded and regenerated identically
- Different baseSeed creates different worlds

### Generation Pipeline

```
1. Calculate chunk seed
2. Create seeded random generator
3. Generate building positions & types
4. Generate obstacle positions & types
5. Generate enemy spawn points
6. Store in database
7. Create meshes
8. Create entities
```

## Persistence Layer

### Database Schema

```sql
CREATE TABLE chunks (
  chunk_x INTEGER,
  chunk_z INTEGER,
  seed INTEGER,
  buildings TEXT,    -- JSON
  obstacles TEXT,    -- JSON
  enemies TEXT,      -- JSON
  visited INTEGER,
  created_at INTEGER,
  PRIMARY KEY (chunk_x, chunk_z)
);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT,
  x REAL, y REAL, z REAL,
  health REAL,
  data TEXT,         -- JSON for extra data
  chunk_x INTEGER,
  chunk_z INTEGER
);

CREATE TABLE player_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  kills INTEGER DEFAULT 0,
  distance_traveled REAL DEFAULT 0,
  bosses_defeated INTEGER DEFAULT 0,
  mechs_called INTEGER DEFAULT 0,
  last_x REAL, last_y REAL, last_z REAL
);
```

### Data Flow

**Chunk Loading**
```
1. Check if chunk exists in database
2. If yes: Load stored data, create entities
3. If no: Generate new chunk, store in database
```

**Chunk Unloading**
```
1. Save entity states to database
2. Dispose meshes
3. Remove entities from ECS world
4. Keep chunk record (seed preserved)
```

**Player Stats**
```
- Updated every frame with position
- Updated on kills, boss defeats
- Used to restore game state on reload
```

## Input System

### Desktop Controls

```typescript
// Keyboard state
const keysPressed = new Set<string>();

window.addEventListener('keydown', (e) => {
  keysPressed.add(e.code);
});

window.addEventListener('keyup', (e) => {
  keysPressed.delete(e.code);
});

// Mouse for aiming
camera.attachControl(canvas, true);
```

### Touch Controls

**Virtual Joysticks**
```
┌─────────────────────┐
│    Base Circle      │
│  ┌─────────────┐    │
│  │   Thumb     │────┼─── Track touch position
│  │   Circle    │    │    relative to center
│  └─────────────┘    │
└─────────────────────┘
```

**Input Normalization**
```typescript
interface TouchInput {
  movement: Vector2;    // -1 to 1 for each axis
  look: Vector2;        // Delta for camera rotation
  isFiring: boolean;
  isSprinting: boolean;
}
```

**Player Integration**
```typescript
// GameManager passes touch input
if (this.touchControls && this.isTouchDevice) {
  this.player.setTouchInput(this.touchControls.getInput());
}

// Player uses whichever input is active
if (usingTouch && this.touchInput) {
  // Use joystick values
} else {
  // Use keyboard/mouse
}
```

## Performance Considerations

### Mobile Optimization

**Simplified Graphics Mode**
```typescript
function shouldUseSimplifiedGraphics(): boolean {
  if (deviceType === 'mobile' && pixelRatio > 2) return true;
  if (navigator.deviceMemory < 4) return true;
  return false;
}
```

When enabled:
- Fewer rock formations (25 vs 50)
- Reduced shadow map resolution
- Lower post-processing quality

**Memory Management**
- Chunk unloading at distance
- Entity disposal when dead
- Texture sharing between similar objects

### Render Optimization

- Frustum culling (automatic in BabylonJS)
- Level of detail (not yet implemented)
- Instancing for repeated objects (planned)

## File Structure Rationale

```
src/game/
├── core/           # Fundamental systems
│   ├── ecs.ts      # Entity Component System
│   ├── gameManager.ts  # Main orchestrator
│   └── lore.ts     # Story data (separate for easy editing)
├── db/             # Persistence
│   └── worldDatabase.ts
├── entities/       # Game objects with behavior
│   ├── mech.ts     # Ally mechs
│   └── player.ts   # Player controller
├── systems/        # Process entities each frame
│   ├── aiSystem.ts
│   └── combatSystem.ts
├── ui/             # User interface
│   ├── hud.ts
│   ├── introSequence.ts
│   ├── mainMenu.ts
│   └── touchControls.ts
├── utils/          # Shared utilities
│   ├── designTokens.ts
│   └── responsive.ts
└── world/          # World generation
    ├── chunkManager.ts
    └── terrainGenerator.ts
```

## Future Architecture Considerations

### Planned Additions

1. **Sound System**
   - Web Audio API
   - Spatial audio for 3D
   - Music manager for tracks

2. **Save/Load System**
   - Full game state serialization
   - IndexedDB for larger saves
   - Cloud sync consideration

3. **Multiplayer** (far future)
   - WebRTC for peer-to-peer
   - Authoritative server option
   - State synchronization

### Scalability

Current architecture supports:
- 100+ simultaneous entities
- Infinite world (chunk-based)
- 10+ enemy types
- Multiple mission chapters

For larger scale:
- Consider spatial partitioning
- Entity pooling for projectiles
- Web Workers for AI

---

*"Architecture is frozen music. But this is a shooter, so maybe more like frozen gunfire."*
