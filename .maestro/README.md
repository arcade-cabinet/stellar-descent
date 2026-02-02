# Maestro E2E Tests

This directory contains cross-platform E2E tests using [Maestro](https://docs.maestro.dev/).

## Structure

```
.maestro/
  config.yaml          # Test suite configuration
  README.md            # This file
  flows/               # Test flow files
    01-smoke.yaml      # Basic app loading tests
    02-main-menu.yaml  # Main menu navigation tests
    03-game-loading.yaml # Game loading flow tests
    04-halo-drop.yaml  # HALO drop (skip tutorial) tests
    05-responsive.yaml # Responsive design tests
```

## Running Tests

### Prerequisites

1. Install Maestro CLI:
   ```bash
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```

2. Ensure Java 17+ is installed:
   ```bash
   java -version
   ```

### Web Testing

Start the dev server first:
```bash
pnpm dev
```

Then run tests:
```bash
# Run all tests
pnpm test:e2e

# Run with explicit web platform
pnpm test:e2e:web

# Run specific test
maestro test .maestro/flows/01-smoke.yaml

# Run with tags
maestro test .maestro/flows/ --include-tags smoke
```

### Android Testing

1. Start an Android emulator or connect a device
2. Build and install the app:
   ```bash
   pnpm build:android
   npx cap open android
   # Build and run from Android Studio
   ```
3. Run tests:
   ```bash
   pnpm test:e2e:android
   ```

### iOS Testing

1. Start an iOS simulator
2. Build and install the app:
   ```bash
   pnpm build:ios
   npx cap open ios
   # Build and run from Xcode
   ```
3. Run tests:
   ```bash
   pnpm test:e2e:ios
   ```

## Writing Tests

Maestro uses YAML for test definitions. Each flow file:

1. Specifies the target app/URL at the top
2. Contains a series of commands to execute

### Cross-Platform Patterns

Use environment variables for platform-specific configuration:

```yaml
appId: ${PLATFORM == 'android' ? 'com.jbcom.stellardescent' : null}
url: ${PLATFORM == 'web' ? 'http://localhost:8080' : null}
```

### Common Commands

- `launchApp` - Launch the app
- `tapOn` - Tap on an element by text or ID
- `assertVisible` - Assert element is visible
- `extendedWaitUntil` - Wait for condition with timeout
- `takeScreenshot` - Capture screenshot

### Test Tags

Use tags for selective test execution:

- `smoke` - Critical path tests (run on every PR)
- `menu` - Menu navigation tests
- `gameplay` - Game mechanics tests
- `loading` - Loading screen tests
- `responsive` - Responsive design tests
- `web-only` - Tests that only run on web

## CI/CD Integration

Tests run automatically in CI:

- **PR checks**: Smoke tests run on web
- **Release**: Full test suite on Android emulator

### GitHub Actions Example

```yaml
- name: Install Maestro
  run: |
    curl -fsSL "https://get.maestro.mobile.dev" | bash
    echo "$HOME/.maestro/bin" >> $GITHUB_PATH

- name: Run E2E Tests
  run: maestro test .maestro/flows/ --format junit --output test-results.xml
```

## Debugging

Use Maestro Studio for interactive debugging:
```bash
# Web
maestro -p web studio

# Android (with emulator running)
maestro studio
```

### Debugging Tips

1. Use `maestro studio` to visually build and debug flows
2. Add `- wait: 1000` between steps if timing issues occur
3. Use `optional: true` for elements that may not always appear
4. Check device logs with `adb logcat` (Android) or Xcode console (iOS)
5. Screenshots are saved to `~/.maestro/tests/` by default

## Resources

- [Maestro Documentation](https://docs.maestro.dev/)
- [Command Reference](https://docs.maestro.dev/api-reference/commands)
- [Desktop Web Testing](https://docs.maestro.dev/platform-support/web-desktop-browser)
