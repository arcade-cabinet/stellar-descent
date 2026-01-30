# Testing Guide

This document describes the testing infrastructure, how to run tests, and guidelines for writing new tests for STELLAR DESCENT: PROXIMA BREACH.

## Overview

The project uses two testing frameworks:

| Framework | Purpose | Location |
|-----------|---------|----------|
| **Vitest** | Unit & integration tests | `src/**/*.test.{ts,tsx}` |
| **Playwright** | End-to-end tests | `e2e/*.spec.ts` |

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

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

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
| `TutorialManager.test.ts` | 15 | Tutorial flow, step progression, objectives |
| `tutorialSteps.test.ts` | 19 | Step configuration validation, shooting range flow |
| `GameContext.test.tsx` | 12 | React context state management |

## End-to-End Tests (Playwright)

### Configuration

E2E tests are configured in `playwright.config.ts`:

- **Browser**: Chromium (headless)
- **Base URL**: `http://localhost:5173`
- **Screenshots**: Captured for all tests
- **Videos**: Retained on failure
- **Web Server**: Auto-starts `pnpm run dev`

### Test File Structure

```
e2e/
├── screenshots/              # Generated screenshots
├── test-results/            # Test artifacts
├── game-flow.spec.ts        # Main game flow tests
├── shooting-range.spec.ts   # Shooting range feature tests
├── smoke-screenshots.spec.ts # Smoke tests with screenshots
└── playthrough.spec.ts      # Full playthrough tests
```

### Writing E2E Tests

#### Basic Test

```typescript
import { test, expect } from '@playwright/test';

test('should display main menu', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible();
});
```

#### With Screenshots

```typescript
import * as path from 'path';

const screenshotsDir = path.join(__dirname, 'screenshots');

test('capture loading screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

  await page.screenshot({
    path: path.join(screenshotsDir, 'loading-screen.png'),
    fullPage: true
  });
});
```

#### Testing Game Interactions

```typescript
test('should advance through tutorial', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

  // Wait for tutorial comms
  await expect(page.getByText(/Good morning, Sergeant Cole/i))
    .toBeVisible({ timeout: 20000 });

  // Advance comms
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);

  // Verify progression
  await expect(page.getByText(/ANCHOR STATION/i)).toBeVisible();
});
```

### Running E2E Tests

```bash
# Run all E2E tests (starts dev server automatically)
pnpm test:e2e

# Run specific test file
npx playwright test game-flow.spec.ts

# Run with headed browser (visible)
npx playwright test --headed

# Run with Playwright UI
pnpm test:e2e:ui

# Generate HTML report
npx playwright show-report
```

### Screenshots Location

Screenshots are saved to `e2e/screenshots/`:

- `smoke-01-main-menu.png` - Main menu
- `smoke-02-controls-modal.png` - Controls modal
- `smoke-03-loading-screen.png` - Loading screen
- `smoke-04-tutorial-comms.png` - Tutorial dialogue
- `responsive-mobile-*.png` - Mobile viewport
- `responsive-tablet-*.png` - Tablet viewport
- `responsive-desktop-*.png` - Desktop viewport

## Test Categories

### Unit Tests

Test isolated logic without browser:

- **State management** - GameContext, stores
- **Game logic** - Tutorial flow, objectives, step validation
- **Utility functions** - Responsive utils, design tokens
- **Data structures** - ECS components, configuration

### Integration Tests

Test multiple systems together:

- **Tutorial flow** - Manager + Steps + Callbacks
- **Combat system** - Projectiles + Damage + AI

### E2E Tests

Test full user journeys:

- **Game flow** - Menu → Loading → Tutorial → Combat
- **UI interactions** - Buttons, modals, controls
- **Responsive design** - Mobile, tablet, desktop
- **Visual regression** - Screenshot comparisons

## Testing the Shooting Range

The weapons calibration mini-game has specific tests:

### Unit Tests (tutorialSteps.test.ts)

```typescript
describe('shooting range flow', () => {
  it('should have armory master intro before shooting range');
  it('should have move_to_range step before calibration');
  it('calibration_start should trigger start_calibration sequence');
});
```

### E2E Tests (shooting-range.spec.ts)

```typescript
test('should show armory master dialogue before shooting range');
test('calibration crosshair should be styled correctly');
```

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
- Use arbitrary timeouts (use `waitFor` instead)
- Skip writing tests for new features
- Ignore flaky tests

## CI/CD Integration

For CI environments, set the `CI` environment variable:

```bash
CI=true pnpm test:all
```

This enables:
- Retries for flaky E2E tests
- Forbids `.only()` in test files
- Starts fresh web server (no reuse)

## Troubleshooting

### Unit Tests

## Error: WebGL not available
- Ensure `src/test/setup.ts` is loaded (check `vitest.config.ts`)

## Error: useGame must be used within GameProvider
- Wrap test component in `<GameProvider>`

### E2E Tests

## Error: Page not loading
- Check dev server is running on port 5173
- Verify `playwright.config.ts` webServer settings

## Tests timing out
- Increase timeout: `await expect(...).toBeVisible({ timeout: 30000 })`
- Check if game state transitions are completing

## Screenshots blank
- Wait for canvas to render: `await page.waitForTimeout(500)`
- Ensure WebGL is initializing

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm test` | Run unit tests in watch mode |
| `pnpm test:run` | Run unit tests once |
| `pnpm test:ui` | Open Vitest UI |
| `pnpm test:coverage` | Run with coverage report |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm test:e2e:ui` | Open Playwright UI |
| `pnpm test:all` | Run all tests |

---

*"Test in peace, deploy in confidence."*
