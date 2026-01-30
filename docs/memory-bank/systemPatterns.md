# System Patterns

## System Overview
The application follows a strict hierarchical flow:
`App.tsx` -> `GameManager.ts` -> Systems (Player, ChunkManager, ECS, AI).

## Core Architecture

### Entry Point
- **App.tsx**: Initializes the BabylonJS Engine (WebGL2) and Havok Physics.
- **GameCanvas.tsx**: React component hosting the canvas and HUD.

### Game Manager
- **GameManager.ts**: The central orchestrator. Manages game state (Menu, Playing, Paused), scene setup, and system coordination.

### Entity Component System (ECS)
- **Library**: Miniplex.
- **Usage**: All game objects (Player, Enemies, Projectiles) are entities composed of data components (Transform, Health, Velocity, AI).
- **Queries**: Systems query the ECS world for specific component combinations (e.g., `world.with('ai', 'transform')`).

### AI System
- **Library**: Yuka.
- **Pattern**: Finite State Machine (FSM).
- **States**: Idle, Patrol, Chase, Attack, Flee, Support.
- **Behaviors**: Steering behaviors (Wander, Seek, Pursuit, Flee).

### World Generation
- **Chunk System**: World is divided into 100x100 unit chunks.
- **Procedural**: Content generated deterministically based on coordinates and a seed.
- **Persistence**: `SQL.js` stores the state of each chunk (entities, visited status) in a local SQLite database.

### Modular Levels
- **Structure**: Each level (e.g., `anchor-station`) is a self-contained module.
- **Files**: `index.ts` (entry), `environment.ts` (meshes), `TutorialManager.ts` (logic), `materials.ts` (assets).

## Data Flow
1. **Input**: Touch/Keyboard -> `GameManager` -> `Player`.
2. **Simulation**: `GameManager` loop -> `AISystem` / `CombatSystem` -> `ECS World` updates.
3. **Rendering**: BabylonJS Engine renders the scene based on `ECS` transforms.
4. **Persistence**: `ChunkManager` saves/loads from `WorldDatabase` on chunk boundaries.
