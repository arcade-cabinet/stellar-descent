# Technical Context

## Technologies
- **Language**: TypeScript.
- **Runtime**: Browser (Vite).
- **Rendering**: BabylonJS 8.x (WebGL2).
- **Physics**: Havok Physics.
- **ECS**: Miniplex.
- **AI**: Yuka.
- **Persistence**: SQL.js (SQLite).
- **Animation**: Anime.js (DOM only), Manual RAF (Babylon objects).
- **UI**: React 19, CSS Modules.

## Development Setup
- **Build Tool**: Vite.
- **Package Manager**: pnpm.
- **Linting**: Biome.
- **Testing**:
    - **Unit**: Vitest + Happy-DOM.
    - **E2E**: Playwright.

## Constraints
- **Mobile Performance**: Optimized for mobile devices. Limit draw calls, shadow map resolution, and complex physics.
- **No WebGPU**: Explicit decision to stick to WebGL2 for stability and "fail fast" debugging.
- **Asset Management**: No external models yet (using primitives). Textures from BabylonJS assets library.

## Dependencies
- `@babylonjs/core`, `@babylonjs/gui`, `@babylonjs/havok`: Core engine.
- `miniplex`: ECS.
- `yuka`: AI.
- `sql.js`: Database.
- `react`, `react-dom`: UI.
- `vitest`, `playwright`: Testing.
