# Project Brief

**STELLAR DESCENT: PROXIMA BREACH** is a mobile-first, 3D arcade shooter built with BabylonJS. The game features procedural world generation, persistent state via SQLite, and a mission-based story campaign.

## Core Philosophy
1. **Mobile-first**: All UI and controls must work on phones first, then scale up.
2. **Military aesthetic**: Olive, khaki, brass colors. NO cyberpunk (no neon, no purple/blue gradients).
3. **Harsh lighting**: Bright alien sun, high contrast, HDR visuals.
4. **Persistent world**: Areas remember their state when revisited.
5. **Story-driven**: Clear narrative with characters players care about.

## Critical Development Rules
- **NO FALLBACKS**: Code should fail fast and explicitly. Do not write try/catch that silently falls back.
- **Fail Fast**: If WebGPU fails, show the error. Do not fallback to WebGL1.
- **No anime.js for Babylon Objects**: Use `requestAnimationFrame` loops for mesh/material animations.

## Key Technical Decisions
- **Engine**: BabylonJS 8.x (WebGL2 only).
- **Physics**: Havok.
- **ECS**: Miniplex.
- **AI**: Yuka.
- **Persistence**: SQL.js (SQLite in browser).
- **Styling**: CSS Modules with Design Tokens.
