# Technical Context

## Technologies
- **Language**: TypeScript 5.9+
- **Runtime**: Browser (Vite 7.x)
- **Node.js**: 22 LTS (pinned via `.nvmrc`)
- **Rendering**: BabylonJS 8.48+ (WebGL2)
- **Physics**: Havok Physics 1.3+
- **ECS**: Miniplex 2.0
- **AI**: Yuka 0.7+
- **Persistence**: SQL.js (SQLite in browser)
- **Audio**: Tone.js 15.x (music), Web Audio API (SFX)
- **Animation**: Anime.js 4.x (DOM only), Manual RAF (Babylon objects)
- **UI**: React 19, CSS Modules

## Development Setup
- **Build Tool**: Vite 7.x
- **Package Manager**: pnpm 10.x
- **Linting**: Biome 2.x
- **Testing**:
  - **Unit**: Vitest 4.x + Happy-DOM
  - **E2E**: Playwright 1.58+
  - **Coverage**: `vitest --coverage`

## CI/CD Pipeline
- **GitHub Actions**: `.github/workflows/ci.yml`
  - Lint check
  - Unit tests
  - Build
  - Netlify deploy (production on main)
- **Deployment**: Netlify
  - Site: `stellar-descent.netlify.app`
  - Secrets: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`

## Key Scripts
```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm test         # Unit tests (watch)
pnpm test:run     # Unit tests (CI)
pnpm test:e2e     # E2E tests
pnpm test:all     # All tests
pnpm lint         # Biome lint + format
```

## Constraints
- **Mobile Performance**: Optimized for mobile. Limited draw calls, shadow map resolution.
- **No WebGPU**: WebGL2 only for stability and "fail fast" debugging.
- **GLB Models**: Using `AssetManager` for PSX-style GLB model loading.
- **Texture Atlas**: Shared textures via `public/textures/` directory.

## Dependencies

### Core
- `@babylonjs/core`, `@babylonjs/gui`, `@babylonjs/havok`: 3D Engine + Physics
- `@babylonjs/loaders`, `@babylonjs/materials`: Asset loading
- `miniplex`: Entity Component System
- `yuka`: AI behaviors and state machines
- `sql.js`: SQLite database in browser
- `tone`: Music playback system

### UI
- `react`, `react-dom`: UI framework (v19)
- `animejs`: DOM animations only

### Dev
- `vite`, `@vitejs/plugin-react`: Build tooling
- `typescript`: Type checking
- `@biomejs/biome`: Linting/formatting
- `vitest`, `happy-dom`: Unit testing
- `@playwright/test`: E2E testing
- `vite-plugin-pwa`: PWA support
- `vite-plugin-compression`: Build optimization

## Architecture Notes

### State Management
- **GameContext**: Player health, kills, missions, HUD visibility
- **KeybindingsContext**: Configurable controls with localStorage
- **WeaponContext**: Weapon state and switching

### Level System
- **ILevel Interface**: Standard lifecycle (initialize, update, dispose)
- **LevelConfig**: Metadata (chapter, act, spawn positions)
- **LevelCallbacks**: Communication back to game system
- **Linked List**: Levels connect via `nextLevelId`/`previousLevelId`

### Asset Management
- **AssetManager**: Centralized GLB/texture loading
- **PSXModelLoader**: Retro-style model processing
- **AudioManager**: SFX playback with pooling
