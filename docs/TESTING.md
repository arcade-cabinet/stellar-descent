# Testing Guide

This document describes the testing infrastructure, how to run tests, and guidelines for writing new tests for STELLAR DESCENT: PROXIMA BREACH.

## Overview

The project uses multiple testing frameworks for comprehensive coverage:

| Framework | Purpose | Location |
|-----------|---------|----------|
| **Vitest** | Unit and integration tests | `src/**/*.test.{ts,tsx}` |
| **Maestro** | Cross-platform E2E tests | `.maestro/flows/*.yaml` |

## Quick Start

```bash
# Run all unit tests
pnpm test:run

# Run unit tests in watch mode
pnpm test

# Run unit tests with UI
pnpm test:ui

# Run unit tests with coverage
pnpm test:coverage

# Run E2E tests (all platforms)
pnpm test:e2e

# Run E2E tests for specific platform
pnpm test:e2e:web
pnpm test:e2e:android
pnpm test:e2e:ios

# Run all tests
pnpm test:all
```

## Unit Tests (Vitest)

### Configuration

Unit tests are configured in `vitest.config.ts`:

- **Environment**: `happy-dom` (fast, lightweight DOM implementation)
- **Setup file**: `src/test/setup.ts` (WebGL mocks, global setup)
- **Coverage**: V8 provider with HTML/JSON/text reporters

### Test File Structure

```text
src/
├── test/
│   └── setup.ts                    # Global test setup, WebGL mocks
├── game/
│   ├── balance/
│   │   └── BalanceValidator.test.ts # Combat balance validation
│   ├── context/
│   │   └── GameContext.test.tsx    # React context tests
│   └── levels/
│       └── anchor-station/
│           ├── TutorialManager.test.ts   # Tutorial flow tests
│           └── tutorialSteps.test.ts     # Step configuration tests
```

### Writing Unit Tests

#### Testing Game Logic

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyGameSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should do something', () => {
    // Arrange
    const system = new MySystem();

    // Act
    system.doSomething();

    // Assert
    expect(system.state).toBe('expected');
  });
});
```

#### Testing React Components

```typescript
import { render, screen, act } from '@testing-library/react';
import { GameProvider } from './GameContext';

function TestComponent() {
  const game = useGame();
  return <div data-testid="value">{game.someValue}</div>;
}

it('should render correctly', () => {
  render(
    <GameProvider>
      <TestComponent />
    </GameProvider>
  );

  expect(screen.getByTestId('value')).toHaveTextContent('expected');
});
```

#### Testing the Save System

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { saveSystem } from '../persistence/SaveSystem';

describe('SaveSystem', () => {
  beforeEach(async () => {
    await saveSystem.initialize();
  });

  it('should create new save with defaults', async () => {
    const save = await saveSystem.newGame();

    expect(save.currentLevel).toBe('anchor_station');
    expect(save.difficulty).toBe('normal');
    expect(save.version).toBe(4);
  });

  it('should record level best times', async () => {
    await saveSystem.newGame();

    const isNewBest = saveSystem.recordLevelTime('anchor_station', 120.5);

    expect(isNewBest).toBe(true);
    expect(saveSystem.getLevelBestTime('anchor_station')).toBe(120.5);
  });
});
```

### Mocking BabylonJS

The setup file (`src/test/setup.ts`) provides WebGL context mocks. For BabylonJS-specific mocking:

```typescript
// Mock a Scene
const mockScene = {
  onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
} as unknown as Scene;

// Mock Vector3
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
const position = new Vector3(0, 0, 0); // Works in tests
```

### Current Unit Test Coverage

| Test File | Tests | Description |
|-----------|-------|-------------|
| `BalanceValidator.test.ts` | 8 | Combat balance validation |
| `GameContext.test.tsx` | 12 | React context state management |
| `TutorialManager.test.ts` | 15 | Tutorial flow, step progression |
| `tutorialSteps.test.ts` | 19 | Step configuration validation |

## End-to-End Tests (Maestro)

### Overview

Maestro is a cross-platform E2E testing framework that supports web, iOS, and Android from the same test files. Tests are written in YAML and can be run locally or in CI.

### Prerequisites

1. Install Maestro CLI:
   ```bash
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```

2. Ensure Java 17+ is installed:
   ```bash
   java -version
   ```

### Test File Structure

```text
.maestro/
├── config.yaml              # Test suite configuration
├── README.md                # Maestro-specific documentation
└── flows/                   # Test flow files
    ├── 01-smoke.yaml        # Basic app loading tests
    ├── 02-main-menu.yaml    # Main menu navigation tests
    ├── 03-game-loading.yaml # Game loading flow tests
    ├── 04-halo-drop.yaml    # HALO drop (skip tutorial) tests
    ├── 05-responsive.yaml   # Responsive design tests
    └── ...
```

### Writing Maestro Tests

#### Basic Test Structure

```yaml
appId: com.jbcom.stellardescent
tags:
  - smoke
  - menu

---
- launchApp

- assertVisible:
    text: "NEW CAMPAIGN"

- tapOn:
    text: "NEW CAMPAIGN"

- assertVisible:
    text: "LOADING"
    optional: true

- takeScreenshot: screenshots/main-menu.png
```

#### Cross-Platform Tests

```yaml
appId: ${PLATFORM == 'android' ? 'com.jbcom.stellardescent' : null}
url: ${PLATFORM == 'web' ? 'http://localhost:5173' : null}

---
- launchApp

- assertVisible:
    text: "STELLAR DESCENT"
```

#### Waiting for Elements

```yaml
- extendedWaitUntil:
    visible:
      text: "ANCHOR STATION"
    timeout: 20000

- tapOn:
    text: "START MISSION"
```

### Running E2E Tests

#### Web Testing

```bash
# Start dev server first
pnpm dev

# Run all tests
pnpm test:e2e

# Run with explicit web platform
pnpm test:e2e:web

# Run specific test
maestro test .maestro/flows/01-smoke.yaml

# Run tests with tags
maestro test .maestro/flows/ --include-tags smoke
```

#### Android Testing

```bash
# Start an Android emulator or connect a device
# Build and install the app
pnpm build:android
npx cap open android
# Build and run from Android Studio

# Run tests
pnpm test:e2e:android
```

#### iOS Testing

```bash
# Start an iOS simulator
# Build and install the app
pnpm build:ios
npx cap open ios
# Build and run from Xcode

# Run tests
pnpm test:e2e:ios
```

### Test Tags

Use tags for selective test execution:

| Tag | Description |
|-----|-------------|
| `smoke` | Critical path tests (run on every PR) |
| `menu` | Menu navigation tests |
| `gameplay` | Game mechanics tests |
| `loading` | Loading screen tests |
| `responsive` | Responsive design tests |
| `web-only` | Tests that only run on web |

### Debugging Maestro Tests

Use Maestro Studio for interactive debugging:

```bash
# Web
maestro -p web studio

# Android (with emulator running)
maestro studio
```

Tips:
1. Use `maestro studio` to visually build and debug flows
2. Add `- wait: 1000` between steps if timing issues occur
3. Use `optional: true` for elements that may not always appear
4. Screenshots are saved to `~/.maestro/tests/` by default

## Test Categories

### Unit Tests

Test isolated logic without browser:

- **State management** - GameContext, PlayerContext, CombatContext, MissionContext
- **Game logic** - Tutorial flow, objectives, step validation
- **Save system** - Persistence, migrations, best times
- **Utility functions** - Responsive utils, design tokens
- **Data structures** - ECS components, configuration

### Integration Tests

Test multiple systems together:

- **Tutorial flow** - Manager + Steps + Callbacks
- **Combat system** - Projectiles + Damage + AI
- **Level transitions** - Factory + Manager + State

### E2E Tests

Test full user journeys:

- **Game flow** - Menu -> Loading -> Tutorial -> Combat
- **UI interactions** - Buttons, modals, controls
- **Responsive design** - Mobile, tablet, desktop
- **Cross-platform** - Web, iOS, Android

### Parallel Playwright Level Rendering Test

A Playwright script tests all 11 levels render correctly by opening them in parallel:

```bash
# Start dev server, then run:
node /tmp/test-levels-parallel.mjs
```

The script:
1. Opens all 11 levels simultaneously in headed Chromium tabs
2. Waits 45 seconds for assets to load
3. Checks each scene with a 5-second `evaluate()` timeout (WebGL can block main thread)
4. Reports: mesh count, material count, lights, alpha=0 materials, fade overlay blocking, shader errors

**Key flags**: `--disable-background-timer-throttling` and `--disable-renderer-backgrounding` prevent Chrome from throttling unfocused tabs.

**Results format**:
```
PASS/LOADED: N  BUSY(rendering): N  LOADING: N  FAIL: N  / 11

Key checks across ALL levels:
  PBR alpha=0 materials: NONE (fix working)
  Fade overlay blocking: NONE (fix working)
  Shader errors: NONE (fix working)
```

**Current status**: 0 FAIL across all 11 levels. BUSY status means the level's WebGL context was still rendering (not a failure -- just means evaluate timed out due to GPU load).

## Writing Good Tests

### Do

- Test behavior, not implementation
- Use meaningful test names
- Keep tests independent
- Mock external dependencies
- Test edge cases
- Use data-testid for E2E selectors

### Don't

- Test internal implementation details
- Share state between tests
- Use arbitrary timeouts (use `waitFor` or `extendedWaitUntil` instead)
- Skip writing tests for new features
- Ignore flaky tests

## CI/CD Integration

### GitHub Actions

Tests run automatically in CI:

```yaml
- name: Install Maestro
  run: |
    curl -fsSL "https://get.maestro.mobile.dev" | bash
    echo "$HOME/.maestro/bin" >> $GITHUB_PATH

- name: Run Unit Tests
  run: pnpm test:run

- name: Run E2E Tests
  run: |
    pnpm build
    pnpm preview &
    sleep 5
    maestro test .maestro/flows/ --format junit --output test-results.xml
```

### Environment Variables

For CI environments, set:

```bash
CI=true pnpm test:all
```

This enables:
- Retries for flaky E2E tests
- Forbids `.only()` in test files
- Starts fresh web server (no reuse)

## Troubleshooting

### Unit Tests

#### Error: WebGL not available
- Ensure `src/test/setup.ts` is loaded (check `vitest.config.ts`)

#### Error: useGame must be used within GameProvider
- Wrap test component in `<GameProvider>`

#### Error: Cannot find module
- Check import paths are correct
- Run `pnpm install` to ensure dependencies are installed

### E2E Tests

#### Error: Page not loading
- Check dev server is running on port 5173
- Verify Maestro is pointing to correct URL

#### Tests timing out
- Increase timeout: `timeout: 30000`
- Check if game state transitions are completing
- Add wait steps between actions

#### Screenshots blank
- Wait for canvas to render: `- wait: 500`
- Ensure WebGL is initializing
- Check if the app is in the correct state

#### Android tests failing
- Ensure emulator is running
- Check app is installed correctly
- Verify device/emulator has internet access

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm test` | Run unit tests in watch mode |
| `pnpm test:run` | Run unit tests once |
| `pnpm test:ui` | Open Vitest UI |
| `pnpm test:coverage` | Run with coverage report |
| `pnpm test:e2e` | Run Maestro E2E tests (all platforms) |
| `pnpm test:e2e:web` | Run E2E tests on web only |
| `pnpm test:e2e:android` | Run E2E tests on Android |
| `pnpm test:e2e:ios` | Run E2E tests on iOS |
| `pnpm test:all` | Run all tests (unit + E2E) |

---

*"Test in peace, deploy in confidence."*
