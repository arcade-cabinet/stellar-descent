# AGENTS.md - AI Agent Instructions

This document provides guidance for AI agents (Claude, GPT, Copilot, etc.) working on the STELLAR DESCENT: PROXIMA BREACH project.

## Project Overview

**STELLAR DESCENT: PROXIMA BREACH** is a mobile-first, 3D arcade shooter built with BabylonJS. The game features procedural world generation, persistent state via SQLite, and a mission-based story campaign.

### Core Philosophy
1. **Mobile-first**: All UI and controls must work on phones first, then scale up
2. **Military aesthetic**: Olive, khaki, brass colors. NO cyberpunk (no neon, no purple/blue gradients)
3. **Harsh lighting**: Bright alien sun, high contrast, HDR visuals
4. **Persistent world**: Areas remember their state when revisited
5. **Story-driven**: Clear narrative with characters players care about

### Critical Development Rules

**NO FALLBACKS** - Code should fail fast and explicitly. Do not write try/catch that silently falls back to alternative implementations. If something fails, we need to see the real error.

```typescript
// BAD - hides real problems
try {
  const webgpu = new WebGPUEngine(canvas);
  await webgpu.initAsync();
  engine = webgpu;
} catch {
  engine = new Engine(canvas); // Silently falls back
}

// GOOD - fail fast
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
});
```

## Critical Files to Understand

Before making changes, read these files:

| File | Purpose |
|------|---------|
| `src/game/core/lore.ts` | ALL story, characters, missions, dialogue |
| `src/game/core/ecs.ts` | Entity Component System - how game objects work |
| `src/game/core/GameManager.ts` | Main game loop and state management |
| `src/game/entities/player.ts` | Player controls, camera, shooting, halo drop |
| `src/game/utils/designTokens.ts` | Colors, spacing, typography |
| `src/game/utils/responsive.ts` | Mobile/responsive utilities |
| `docs/ARCHITECTURE.md` | Technical architecture decisions |
| `docs/DESIGN.md` | Design system and UI/UX guidelines |

## Key Technical Decisions

### Rendering
- **WebGL2 only** - no WebGPU fallback complexity
- Use BabylonJS texture library: `https://assets.babylonjs.com/textures/`
- No custom 3D models yet - use primitives (boxes, cylinders, capsules)

### Animation
- **Do NOT use anime.js** for Babylon objects - the v4 API doesn't work well with BabylonJS objects
- Use `requestAnimationFrame` loops for mesh/material animations
- Keep animations simple and manual

```typescript
// BAD - anime.js with Babylon objects
animate({
  targets: mesh.scaling,
  x: [1, 2],
  duration: 300,
});

// GOOD - manual animation
const startTime = performance.now();
const duration = 300;
const animateScale = () => {
  const progress = Math.min((performance.now() - startTime) / duration, 1);
  mesh.scaling.x = 1 + progress;
  if (progress < 1) requestAnimationFrame(animateScale);
};
requestAnimationFrame(animateScale);
```

### Entity System
- **Miniplex ECS** for all game entities
- Components: Transform, Health, Velocity, Combat, AI, Renderable, Tags
- Use `createEntity()` from `src/game/core/ecs.ts`

### AI System
- **Yuka** for steering behaviors
- States: idle, patrol, chase, attack, flee, support
- Enemies detect player via `alertRadius` and `attackRadius`

### Persistence
- **SQL.js** (SQLite in browser)
- Tables: `chunks`, `entities`, `player_stats`
- Chunks store procedural generation seeds for consistency

### Responsive Design
- Use `getScreenInfo()` from responsive.ts
- Device types: mobile, tablet, foldable, desktop
- Always test with touch controls

## Code Style

### TypeScript
```typescript
// Use explicit types
function createEnemy(position: Vector3, type: EnemyType): Entity {
  // ...
}

// Prefer const
const CHUNK_SIZE = 100;

// Use tokens for colors
material.diffuseColor = Color3.FromHexString(tokens.colors.primary.olive);
```

### Imports
```typescript
// BabylonJS - import specific modules
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// Local imports
import { tokens } from '../utils/designTokens';
import { createEntity } from '../core/ecs';
```

### UI Elements (React Components)
```typescript
// Always use design tokens via CSS modules
// Check existing patterns in src/components/ui/
```

## Common Tasks

### Adding a New Enemy Type

1. Define in `src/game/core/lore.ts` under `LORE.enemies.variants`
2. Add mesh creation in `src/game/world/chunkManager.ts`
3. Configure AI parameters (alertRadius, attackRadius, damage)
4. Update stats in `docs/LORE.md`

### Adding a New Mission/Chapter

1. Add to `MISSION_BRIEFINGS` in `src/game/core/lore.ts`
2. Create trigger conditions in `GameManager.ts`
3. Update `docs/LORE.md` with full narrative
4. Log changes in `docs/DEVLOG.md`

### Adding UI Elements

1. Check if similar element exists in `src/components/ui/`
2. Create React component with CSS module
3. Apply design tokens for colors
4. Make responsive using `getScreenInfo()`
5. Test on mobile viewport

### Modifying World Generation

1. Update `ChunkManager` in `src/game/world/chunkManager.ts`
2. Generation is seed-based - changes affect all future chunks
3. Consider memory limits on mobile
4. Update `docs/ARCHITECTURE.md` if algorithm changes

## Testing Checklist

Before submitting changes:

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:run` passes (unit tests)
- [ ] Test on mobile viewport (Chrome DevTools)
- [ ] Test touch controls
- [ ] Test keyboard/mouse controls
- [ ] Check HUD doesn't overlap touch controls
- [ ] Verify design tokens are used (no hardcoded colors)
- [ ] Update relevant documentation
- [ ] Add tests for new features

### Running Tests

```bash
# Unit tests (fast, run frequently)
pnpm test:run

# Unit tests with watch mode (during development)
pnpm test

# E2E tests (slower, run before committing)
pnpm test:e2e

# All tests
pnpm test:all
```

### Writing Tests

For new features, add tests in the appropriate location:
- **Game logic** → `src/game/**/*.test.ts`
- **React components** → `src/components/**/*.test.tsx`
- **User flows** → `e2e/*.spec.ts`

See `docs/TESTING.md` for detailed testing guidelines.

## Documentation Updates

When making significant changes:

1. **Code changes** → Update `docs/ARCHITECTURE.md`
2. **Story/lore changes** → Update `docs/LORE.md`
3. **Design changes** → Update `docs/DESIGN.md`
4. **Any changes** → Add entry to `docs/DEVLOG.md`

## What NOT to Do

1. **Don't add fallbacks** - fail fast, show real errors
2. **Don't use anime.js with Babylon objects** - use requestAnimationFrame
3. **Don't add cyberpunk aesthetics** - no neon, no purple/blue gradients
4. **Don't use dark scenes** - the planet has harsh sunlight
5. **Don't hardcode colors** - use design tokens
6. **Don't forget mobile** - test touch controls
7. **Don't skip documentation** - update DEVLOG.md at minimum
8. **Don't break persistence** - chunk seeds must be stable

## Getting Help

If you're unsure about something:

1. Check `docs/` directory for context
2. Read `src/game/core/lore.ts` for story consistency
3. Look at existing code patterns
4. When in doubt, ask the user for clarification

## Current Development Phase

**Phase 2: Core Gameplay Loop** (see `docs/DEVLOG.md`)

Priority tasks:
1. Fix mechanical issues (movement, firing, camera)
2. Tutorial level on Anchor Station Prometheus
3. Commander dialogue system
4. Mission triggers and progression

---

*Remember: This is a story about a soldier finding his brother on an alien world. Keep it grounded, military, and human.*
