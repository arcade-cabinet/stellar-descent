# Maestro Mobile Testing

This directory contains Maestro flows for automated mobile UI testing of Stellar Descent.

## Prerequisites

1. Install Maestro CLI:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. Build and install the app on a device/emulator:
   ```bash
   # iOS
   pnpm build:ios
   pnpm cap:open:ios
   # Build and run from Xcode

   # Android
   pnpm build:android
   pnpm cap:open:android
   # Build and run from Android Studio
   ```

## Running Tests

### Single Flow
```bash
maestro test .maestro/flows/app-launch.yaml
```

### All Flows
```bash
maestro test .maestro/flows/
```

### With Studio (Visual Debugger)
```bash
maestro studio
```

### Generate HTML Report
```bash
maestro test .maestro/flows/ --format html --output test-results/
```

## Available Flows

| Flow | Description |
|------|-------------|
| `app-launch.yaml` | Verifies app launches and shows main menu |
| `new-game-start.yaml` | Starts a new game and enters tutorial |
| `touch-controls.yaml` | Tests mobile touch input (joystick, fire, etc.) |
| `settings-menu.yaml` | Tests settings menu navigation |
| `pause-resume.yaml` | Tests pause menu during gameplay |
| `tutorial-complete.yaml` | Plays through Anchor Station tutorial |
| `orientation-check.yaml` | Verifies landscape enforcement |
| `full-playthrough.yaml` | Extended smoke test of full campaign |

## Configuration

Global settings are in `config/global.yaml`:
- App ID: `com.jbcom.stellardescent`
- Timeouts, retry settings
- Screenshot/video capture settings

## Writing New Flows

```yaml
appId: com.jbcom.stellardescent

---
- launchApp:
    clearState: true  # Start fresh each time

- assertVisible:
    text: "Expected Text"
    timeout: 10000    # Wait up to 10 seconds

- tapOn:
    text: "Button Text"
    # or
    id: "element-id"
    # or
    point: "50%, 50%"  # Screen coordinates

- swipe:
    start: "10%, 70%"
    end: "20%, 60%"
    duration: 500

- takeScreenshot: "screenshot_name"
```

## CI Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run Maestro Tests
  uses: mobile-dev-inc/action-maestro-cloud@v1
  with:
    api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
    app-file: dist/stellar-descent.apk
    flows: .maestro/flows/
```

## Debugging Tips

1. Use `maestro studio` to visually build and debug flows
2. Add `- wait: 1000` between steps if timing issues occur
3. Use `optional: true` for elements that may not always appear
4. Check device logs with `adb logcat` (Android) or Xcode console (iOS)
5. Screenshots are saved to `~/.maestro/tests/` by default
