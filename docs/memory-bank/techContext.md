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
- **Texture Atlas**: Shared textures via `public/assets/textures/` directory.

## Asset Organization
All game assets are consolidated under `public/assets/`:
```
public/assets/
├── models/       # GLB 3D models (803+ models)
├── textures/     # Texture files
├── audio/        # Sound effects and music
└── videos/       # Splash screens and cinematics
    └── splash/   # Splash videos (main_16x9.mp4, main_9x16.mp4)
```

## GenAI Asset Generation System
Manifest-driven asset generation using Google AI models:

### Models Used
- **Gemini 3 Pro**: Image generation (portraits, textures)
- **Veo 3.1**: Video generation (cinematics, splash screens)

### Video Configuration
- Resolution: 1080p
- Duration: 8 seconds
- Aspect Ratios: 16:9 and 9:16 (for landscape/portrait)
- Audio: Native AI-generated audio

### CLI Commands
```bash
# Generate specific asset types
pnpm exec tsx scripts/generate-assets.ts portraits
pnpm exec tsx scripts/generate-assets.ts splash
pnpm exec tsx scripts/generate-assets.ts cinematics
pnpm exec tsx scripts/generate-assets.ts status
```

### Schema Locations
- `src/game/ai/schemas/GenerationManifestSchemas.ts` - Zod schemas for generation manifests
- `src/game/ai/schemas/AssetManifestSchemas.ts` - Zod schemas for asset metadata

### Manifest Structure
Manifests live alongside assets (e.g., `public/assets/videos/splash/manifest.json`) and define:
- Asset metadata (name, description)
- Generation parameters (model, resolution, duration)
- Output specifications

### VCR Testing
Uses Polly.JS for deterministic CI replay of API responses, enabling reliable testing without live API calls.

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
- **AssetManager**: Centralized GLB/texture loading from `public/assets/models/`
- **PSXModelLoader**: Retro-style model processing
- **AudioManager**: SFX playback with pooling from `public/assets/audio/`
- **GenAI Generation**: Manifest-driven asset generation with Zod schemas
