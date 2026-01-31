# AGENTS.md - AI Agent Instructions

This document provides guidance for AI agents (Claude, GPT, Copilot, etc.) working on the STELLAR DESCENT: PROXIMA BREACH project.

## Project Overview

**STELLAR DESCENT: PROXIMA BREACH** is a mobile-first, 3D arcade shooter built with BabylonJS. The game features a 10-level campaign, procedural world generation, persistent state via IndexedDB, and native mobile support via Capacitor.

### Core Philosophy

1. **Mobile-first**: All UI and controls must work on phones first, then scale up
2. **Military aesthetic**: Olive, khaki, brass colors. NO cyberpunk (no neon, no purple/blue gradients)
3. **Harsh lighting**: Bright alien sun, high contrast, HDR visuals
4. **Persistent saves**: Game progress persists across sessions via IndexedDB
5. **Story-driven**: 10-level campaign with clear narrative across 4 acts

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
| `src/game/context/GameContext.tsx` | Unified context facade (combines Player, Combat, Mission) |
| `src/game/context/PlayerContext.tsx` | Player state, health, death, HUD visibility |
| `src/game/context/CombatContext.tsx` | Combat state, kills, music |
| `src/game/context/MissionContext.tsx` | Objectives, comms, chapters, notifications |
| `src/game/levels/types.ts` | Level configs, 10-level campaign structure |
| `src/game/levels/factories.ts` | Level factory registry |
| `src/game/persistence/SaveSystem.ts` | Save/load game state |
| `src/game/persistence/GameSave.ts` | Save data structure (v4 format) |
| `src/game/entities/player.ts` | Player controls, camera, shooting |
| `src/game/utils/designTokens.ts` | Colors, spacing, typography |
| `docs/ARCHITECTURE.md` | Technical architecture decisions |
| `docs/DESIGN.md` | Design system and UI/UX guidelines |
| `docs/LEVELS.md` | Level system documentation |

## Key Technical Decisions

### Rendering

- **WebGL2 only** - no WebGPU fallback complexity
- Use BabylonJS texture library: `https://assets.babylonjs.com/textures/`
- Models in `public/models/` directory

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

### React Context Architecture

The game uses a split context pattern for better performance:

```typescript
// OLD (deprecated) - monolithic context
const { health, kills, objectives } = useGame();

// NEW (preferred) - focused contexts
const { health, isDead, difficulty } = usePlayer();
const { kills, inCombat } = useCombat();
const { currentObjective, commsMessage } = useMission();

// Facade still available for backwards compatibility
const game = useGame(); // Combines all three
```

### Entity System

- **Miniplex ECS** for all game entities
- Components: Transform, Health, Velocity, Combat, AI, Renderable, Tags, AlienInfo
- Use `createEntity()` from `src/game/core/ecs.ts`

### AI System

- **Yuka** for steering behaviors
- States: idle, patrol, chase, attack, flee, support
- Enemies detect player via `alertRadius` and `attackRadius`

### Save System (v4)

```typescript
interface GameSave {
  version: 4;                    // Current format version
  currentLevel: LevelId;         // Which level player is on
  levelsCompleted: LevelId[];    // Completed levels
  levelBestTimes: Record<LevelId, number>;  // Best times in seconds
  difficulty: DifficultyLevel;   // Easy, Normal, Hard, Nightmare
  seenIntroBriefing: boolean;    // Skip intro on replay
  // ... more fields
}
```

### Level System

The game uses a linked-list level structure:

```typescript
// 10 levels across 4 acts
type LevelId =
  | 'anchor_station'    // Chapter 1: Tutorial
  | 'landfall'          // Chapter 2: HALO drop
  | 'canyon_run'        // Chapter 3: Vehicle chase
  | 'fob_delta'         // Chapter 4: Horror investigation
  | 'brothers_in_arms'  // Chapter 5: Mech combat
  | 'southern_ice'      // Chapter 6: Ice level
  | 'the_breach'        // Chapter 7: Queen boss fight
  | 'hive_assault'      // Chapter 8: Combined arms
  | 'extraction'        // Chapter 9: Wave holdout
  | 'final_escape';     // Chapter 10: Vehicle finale
```

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

1. Define in `src/game/entities/aliens.ts`
2. Add mesh creation logic
3. Configure AI parameters (alertRadius, attackRadius, damage)
4. Update stats in `docs/LORE.md`

### Adding a New Level

1. Create level directory: `src/game/levels/{level-name}/`
2. Implement level class extending `BaseLevel`
3. Register factory in `src/game/levels/factories.ts`
4. Add to `CAMPAIGN_LEVELS` in `src/game/levels/types.ts`
5. Update `docs/LEVELS.md` with level documentation

### Adding UI Elements

1. Check if similar element exists in `src/components/ui/`
2. Create React component with CSS module
3. Apply design tokens for colors
4. Make responsive using `getScreenInfo()`
5. Test on mobile viewport

### Working with Saves

```typescript
import { saveSystem } from '../persistence/SaveSystem';

// Load existing save or create new
await saveSystem.initialize();
const save = await saveSystem.loadGame() ?? await saveSystem.newGame();

// Update save during gameplay
saveSystem.setCurrentLevel('landfall');
saveSystem.addKill();
saveSystem.completeLevel('anchor_station');

// Record level completion time
const isNewBest = saveSystem.recordLevelTime('anchor_station', 125.5);
```

## Testing

### Test Commands

```bash
# Unit tests (fast, run frequently)
pnpm test:run

# Unit tests with watch mode (during development)
pnpm test

# E2E tests with Maestro
pnpm test:e2e

# All tests
pnpm test:all
```

### Test File Locations

- **Game logic** -> `src/game/**/*.test.ts`
- **React components** -> `src/components/**/*.test.tsx`
- **E2E flows** -> `.maestro/flows/*.yaml`

### Testing Checklist

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

## Documentation Updates

When making significant changes:

1. **Code changes** -> Update `docs/ARCHITECTURE.md`
2. **Story/lore changes** -> Update `docs/LORE.md`
3. **Design changes** -> Update `docs/DESIGN.md`
4. **Level changes** -> Update `docs/LEVELS.md`
5. **Any changes** -> Add entry to `docs/DEVLOG.md`

## What NOT to Do

1. **Don't add fallbacks** - fail fast, show real errors
2. **Don't use anime.js with Babylon objects** - use requestAnimationFrame
3. **Don't add cyberpunk aesthetics** - no neon, no purple/blue gradients
4. **Don't use dark scenes** - the planet has harsh sunlight
5. **Don't hardcode colors** - use design tokens
6. **Don't forget mobile** - test touch controls
7. **Don't skip documentation** - update DEVLOG.md at minimum
8. **Don't break saves** - maintain backwards compatibility with migrations

## Getting Help

If you're unsure about something:

1. Check `docs/` directory for context
2. Read `src/game/levels/types.ts` for campaign structure
3. Look at existing code patterns
4. When in doubt, ask the user for clarification

## Current Development Phase

**Phase 5: Polish** (see `docs/DEVLOG.md`)

- 10-level campaign complete
- Save system v4 with best times
- CI/CD pipeline with Netlify
- PWA and Capacitor integration

Current priorities:
1. Wire keybindings to all level inputs
2. Weapon switching UI for touch
3. E2E test expansion
4. Performance optimization for mobile

---

*Remember: This is a story about a soldier finding his brother on an alien world. Keep it grounded, military, and human.*
