# Contributing to STELLAR DESCENT

Thank you for your interest in contributing to STELLAR DESCENT: PROXIMA BREACH. This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- **Node.js 22+** (check with `node --version`)
- **pnpm 10+** (check with `pnpm --version`)
- **Git**

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/stellar-descent.git
   cd stellar-descent
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open http://localhost:5173 in your browser

### Project Structure

```
stellar-descent/
├── .maestro/           # E2E test flows (Maestro)
├── docs/               # Documentation
├── public/             # Static assets
│   ├── models/         # 3D models (.glb)
│   └── textures/       # Texture files
├── src/
│   ├── components/     # React components
│   │   └── ui/         # UI components
│   ├── css/            # Global styles
│   ├── game/           # Game logic
│   │   ├── context/    # React contexts
│   │   ├── core/       # Core systems
│   │   ├── entities/   # Game entities
│   │   ├── levels/     # Level implementations
│   │   ├── persistence/# Save system
│   │   ├── systems/    # ECS systems
│   │   └── world/      # World generation
│   └── hooks/          # Custom React hooks
└── tests/              # Test utilities
```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code, deployed to Netlify
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the [Code Style](#code-style) guidelines

3. Run tests:
   ```bash
   pnpm test:run    # Unit tests
   pnpm test:e2e    # E2E tests (requires Maestro)
   ```

4. Check types:
   ```bash
   pnpm tsc --noEmit
   ```

5. Format code:
   ```bash
   pnpm format
   ```

6. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

7. Push and create a pull request

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Build process or tooling changes

Examples:
```
feat: add level best times tracking
fix: resolve health clamping bug
docs: update campaign structure in README
refactor: split GameContext into focused contexts
test: add unit tests for SaveSystem
```

## Code Style

### TypeScript

- Use explicit types (avoid `any`)
- Use `const` for values that don't change
- Use design tokens for colors and spacing

```typescript
// Good
const CHUNK_SIZE = 100;
function createEnemy(position: Vector3, type: EnemyType): Entity {
  // ...
}

// Avoid
let CHUNK_SIZE = 100;
function createEnemy(position, type): any {
  // ...
}
```

### React Components

- Use functional components with hooks
- Use CSS modules for styling
- Apply design tokens from `designTokens.ts`

```typescript
// Good
import styles from './MyComponent.module.css';
import { tokens } from '../utils/designTokens';

export function MyComponent() {
  return <div className={styles.container}>...</div>;
}
```

### BabylonJS

- Import specific modules (not the entire package)
- Use manual animations (not anime.js with Babylon objects)

```typescript
// Good
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// Avoid
import * as BABYLON from '@babylonjs/core';
```

## Testing

### Unit Tests (Vitest)

Unit tests are located next to the files they test:

```
src/game/context/GameContext.tsx
src/game/context/GameContext.test.tsx
```

Run unit tests:
```bash
pnpm test        # Watch mode
pnpm test:run    # Single run
pnpm test:coverage  # With coverage
```

### E2E Tests (Maestro)

E2E tests are in `.maestro/flows/`:

```
.maestro/flows/
├── 01-smoke.yaml
├── 02-main-menu.yaml
├── 03-game-loading.yaml
└── ...
```

Run E2E tests:
```bash
pnpm test:e2e        # All platforms
pnpm test:e2e:web    # Web only
```

### Writing Tests

For new features, add tests that cover:
- Happy path
- Edge cases
- Error handling

```typescript
describe('SaveSystem', () => {
  it('should create new save with default values', async () => {
    const save = await saveSystem.newGame();
    expect(save.currentLevel).toBe('anchor_station');
    expect(save.difficulty).toBe('normal');
  });

  it('should migrate old save formats', async () => {
    const oldSave = { version: 2, /* ... */ };
    // Test migration logic
  });
});
```

## Documentation

### When to Update Docs

- **README.md** - Project overview, quick start, feature list
- **AGENTS.md** - AI agent instructions, coding patterns
- **CHANGELOG.md** - Version history, notable changes
- **docs/ARCHITECTURE.md** - Technical architecture, system design
- **docs/DESIGN.md** - UI/UX guidelines, design tokens
- **docs/LEVELS.md** - Level system, campaign structure
- **docs/LORE.md** - Story, characters, world building
- **docs/TESTING.md** - Testing guide, test patterns
- **docs/DEVLOG.md** - Development progress, session logs

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Keep tables aligned and readable
- Update the table of contents if adding sections

## Pull Request Guidelines

### Before Submitting

1. All tests pass (`pnpm test:run`)
2. Type check passes (`pnpm tsc --noEmit`)
3. Code is formatted (`pnpm format`)
4. Documentation is updated
5. Commit messages follow convention

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Tested on mobile viewport
- [ ] Tested with touch controls

## Documentation
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] Other docs updated (specify)

## Screenshots (if applicable)
```

## Design Guidelines

### Visual Style

- **Military aesthetic** - Olive, khaki, brass colors
- **No cyberpunk** - No neon, no purple/blue gradients
- **Harsh lighting** - High contrast, bright alien sun
- **Mobile-first** - Design for 375px width, scale up

### Color Palette

Use tokens from `src/game/utils/designTokens.ts`:

```typescript
tokens.colors.primary.olive      // Primary color
tokens.colors.primary.oliveDark  // Dark variant
tokens.colors.accent.brass       // Accent/highlight
tokens.colors.ui.text            // Text color
tokens.colors.ui.danger          // Error/danger
```

### Touch Targets

- Minimum 44x44px for interactive elements
- 8px minimum spacing between targets
- Consider thumb reach zones

## Getting Help

- Check existing documentation in `docs/`
- Review similar code in the codebase
- Ask questions in the PR discussion
- Reference the [AGENTS.md](./AGENTS.md) for coding patterns

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

---

*"Every contribution, no matter how small, helps bring this game to life."*
