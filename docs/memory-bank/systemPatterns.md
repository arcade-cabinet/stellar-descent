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
