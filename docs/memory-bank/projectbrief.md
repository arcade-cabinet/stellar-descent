# Project Brief

**STELLAR DESCENT: PROXIMA BREACH** is a mobile-first, 3D arcade shooter built with BabylonJS. The game features a 6-level story campaign, dynamic enemy AI, and a persistent world state.

## Core Philosophy
1. **Mobile-first**: All UI and controls must work on phones first, then scale up.
2. **Military aesthetic**: Olive, khaki, brass colors. NO cyberpunk (no neon, no purple/blue gradients).
3. **Harsh lighting**: Bright alien sun, high contrast, HDR visuals.
4. **Persistent world**: Areas remember their state when revisited.
5. **Story-driven**: Clear narrative about brotherhood and survival.

## Critical Development Rules
- **NO FALLBACKS**: Code should fail fast and explicitly.
- **Fail Fast**: If WebGPU fails, show the error. Do not fallback to WebGL1.
- **No anime.js for Babylon Objects**: Use `requestAnimationFrame` loops for mesh/material animations.
- **Test Coverage**: Unit tests (Vitest) and E2E tests (Playwright) required.
- **CI/CD**: All changes go through GitHub Actions, deploy to Netlify.

## Key Technical Decisions
- **Engine**: BabylonJS 8.x (WebGL2 only)
- **Physics**: Havok
- **ECS**: Miniplex
- **AI**: Yuka
- **Persistence**: SQL.js (SQLite in browser)
- **Audio**: Tone.js (music), Web Audio API (SFX)
- **Styling**: CSS Modules with Design Tokens
- **Node.js**: 22 LTS (pinned in `.nvmrc`)
- **Package Manager**: pnpm 10.x

## Campaign Overview
6 levels across 3 acts:
1. Anchor Station (Tutorial)
2. Landfall (HALO Drop)
3. FOB Delta (Horror/Investigation)
4. Brothers in Arms (Mech Ally Combat)
5. The Breach (Boss Fight)
6. Extraction (Escape Sequence)

## Deployment
- **URL**: https://stellar-descent.netlify.app
- **CI/CD**: GitHub Actions -> Netlify
- **Branch**: `main` for production deploys

## Repository Structure
```
stellar-descent/
├── src/
│   ├── components/     # React UI components
│   ├── game/
│   │   ├── context/    # GameContext, KeybindingsContext, WeaponContext
│   │   ├── core/       # AudioManager, AssetManager, PSXModelLoader
│   │   ├── ecs/        # ECS components and systems
│   │   ├── levels/     # Campaign levels (6 total)
│   │   └── systems/    # Combat, AI, Player systems
│   └── App.tsx
├── e2e/                # Playwright E2E tests
├── public/
│   ├── models/         # GLB model files
│   └── textures/       # Texture atlas
├── docs/
│   └── memory-bank/    # AI context files
└── .github/workflows/  # CI/CD configuration
```
