# Stellar Descent - Distribution Guide

This document covers all distribution channels for Stellar Descent across platforms.

## Table of Contents

- [Overview](#overview)
- [Web (Netlify)](#web-netlify)
- [Android (Google Play Store)](#android-google-play-store)
- [Android (Direct APK)](#android-direct-apk)
- [iOS (App Store / TestFlight)](#ios-app-store--testflight)
- [Steam](#steam)
- [Desktop Direct (Electron)](#desktop-direct-electron)
- [GitHub Secrets Reference](#github-secrets-reference)

---

## Overview

| Platform | Distribution Method | Cost | Review Time | Beta Testing |
|----------|---------------------|------|-------------|--------------|
| **Web** | Netlify | Free | None | Preview deploys |
| **Android** | Google Play | $25 one-time | 1-3 days | Internal/Closed/Open tracks |
| **Android** | Direct APK | Free | None | GitHub Releases |
| **iOS** | App Store | $99/year | 1-7 days | TestFlight |
| **Steam** | Steamworks | $100/app | 1-5 days | Beta branch |
| **Desktop** | Direct Download | Free | None | GitHub Releases |

---

## Web (Netlify)

### Setup
1. Create Netlify account and site
2. Get site ID from Netlify dashboard
3. Generate personal access token

### Secrets Required
```
NETLIFY_AUTH_TOKEN    # Personal access token
NETLIFY_SITE_ID       # Already configured: 1df7d7e0-b11c-4a74-8530-3b673b5b36ce
```

### Workflow
- **CD**: Every push to main deploys preview
- **Release**: Tagged releases deploy to production

---

## Android (Google Play Store)

### Prerequisites
1. **Google Play Developer Account** - $25 one-time fee
   - https://play.google.com/console/signup

2. **Create App Listing**
   - App name: "Stellar Descent"
   - Package name: `com.jbcom.stellardescent`
   - Complete store listing, content rating, pricing

3. **Service Account** (for API access)
   - Go to Google Cloud Console → IAM & Admin → Service Accounts
   - Create service account with Play Console access
   - Download JSON key file
   - In Play Console: Setup → API Access → Link to service account

4. **Release Signing Key**
   - Generate production keystore (different from debug)
   - Consider using Play App Signing (Google manages key)

### Secrets Required
```
GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64   # Base64 encoded service account JSON
ANDROID_RELEASE_KEYSTORE_BASE64      # Base64 encoded production .jks
ANDROID_RELEASE_KEYSTORE_PASSWORD    # Production keystore password
ANDROID_RELEASE_KEY_ALIAS            # Production key alias
ANDROID_RELEASE_KEY_PASSWORD         # Production key password
```

### Release Tracks
| Track | Purpose | Testers |
|-------|---------|---------|
| **Internal** | Team testing | Up to 100 |
| **Closed (Alpha)** | Private beta | Invite by email/link |
| **Open (Beta)** | Public beta | Anyone can join |
| **Production** | Public release | Everyone |

### Generate Production Keystore
```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore stellar-descent-release.jks \
  -storepass YOUR_SECURE_PASSWORD \
  -keypass YOUR_SECURE_PASSWORD \
  -alias stellar-descent-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Stellar Descent, OU=Games, O=jbcom, L=San Francisco, S=California, C=US"

# Encode for GitHub secret
base64 -i stellar-descent-release.jks
```

---

## Android (Direct APK)

For users who can't or don't want to use Google Play.

### Distribution
- Debug APKs attached to GitHub Releases
- Multiple ABI variants: arm64-v8a, armeabi-v7a, x86_64

### Current Secrets (Debug)
```
ANDROID_KEYSTORE_BASE64        # Debug keystore (already generated)
ANDROID_KEYSTORE_PASSWORD      # stellardescent
ANDROID_KEY_ALIAS              # stellardescent-debug
ANDROID_KEY_PASSWORD           # stellardescent
```

---

## iOS (App Store / TestFlight)

### Prerequisites
1. **Apple Developer Program** - $99/year
   - https://developer.apple.com/programs/enroll/

2. **App Store Connect Setup**
   - Create App ID: `com.jbcom.stellardescent`
   - Create app record in App Store Connect
   - Complete app information, screenshots, etc.

3. **API Key** (for automation)
   - App Store Connect → Users and Access → Keys
   - Generate key with "Admin" or "App Manager" role
   - Download .p8 file (only available once!)

4. **Certificate Management** (using Match)
   - Create private Git repo for certificates
   - Run `fastlane match init` locally first
   - Generate certificates: `fastlane match appstore`

### Secrets Required
```
APPLE_API_KEY_ID               # Key ID from App Store Connect
APPLE_API_ISSUER_ID            # Issuer ID from App Store Connect
APPLE_API_KEY_BASE64           # Base64 encoded .p8 key file
APPLE_TEAM_ID                  # Team ID from developer.apple.com
MATCH_PASSWORD                 # Password to encrypt Match certificates
MATCH_GIT_URL                  # git@github.com:jbogaty/stellar-descent-certs.git
MATCH_GIT_BASIC_AUTH           # Base64 encoded git credentials (optional)
```

### TestFlight Distribution
| Group | Limit | Review Required | Access |
|-------|-------|-----------------|--------|
| **Internal** | 100 | No (first build only) | Team members |
| **External** | 10,000 | Yes (Beta App Review) | Anyone with link |

### Local Setup
```bash
cd ios/App
bundle install
bundle exec fastlane match init        # First time only
bundle exec fastlane match appstore    # Generate/fetch certificates
bundle exec fastlane beta              # Build and upload to TestFlight
```

---

## Steam

### Prerequisites
1. **Steamworks Account**
   - https://partner.steamgames.com/
   - Pay $100 app credit (refundable after $1000 revenue)

2. **App Configuration**
   - Create new app in Steamworks
   - Note your App ID
   - Create depots for each platform (Windows, macOS, Linux)
   - Configure launch options

3. **SteamCMD Authentication**
   - Install SteamCMD locally
   - Login once with Steam Guard to generate config.vdf
   - This file contains your auth token

### Secrets Required
```
STEAM_USERNAME                 # Steamworks partner account username
STEAM_CONFIG_VDF_BASE64        # Base64 encoded ~/.steam/config/config.vdf
```

### Repository Variables
```
STEAM_APP_ID                   # Your app's Steam ID (e.g., 1234567)
STEAM_DEPOT_WINDOWS            # Windows depot ID
STEAM_DEPOT_MACOS              # macOS depot ID
STEAM_DEPOT_LINUX              # Linux depot ID
```

### Steam Branches
| Branch | Purpose |
|--------|---------|
| **default** | Public release (requires setting live) |
| **beta** | Beta testing (opt-in) |
| **preview** | Early access preview |

### Local Setup
```bash
# Install SteamCMD
brew install steamcmd  # macOS
# or download from https://developer.valvesoftware.com/wiki/SteamCMD

# Login (will prompt for Steam Guard)
steamcmd +login YOUR_USERNAME +quit

# The config.vdf is now at ~/.steam/config/config.vdf
base64 -i ~/.steam/config/config.vdf  # For GitHub secret
```

### Steamworks Integration (Optional)
For achievements, cloud saves, etc., add Steamworks SDK:
```bash
npm install steamworks.js
```

---

## Desktop Direct (Electron)

For users who prefer direct downloads over Steam.

### Distribution
- GitHub Releases with installers
- **Windows**: NSIS installer (.exe)
- **macOS**: DMG disk image (.dmg)
- **Linux**: AppImage + .deb package

### Code Signing (Optional but Recommended)

#### Windows
```
WIN_CSC_LINK                   # Base64 encoded .pfx certificate
WIN_CSC_KEY_PASSWORD           # Certificate password
```

#### macOS
```
CSC_LINK                       # Base64 encoded .p12 certificate
CSC_KEY_PASSWORD               # Certificate password
APPLE_ID                       # For notarization
APPLE_ID_PASSWORD              # App-specific password
```

Without signing, users will see security warnings.

---

## GitHub Secrets Reference

### Complete List

#### Core (Required for CI)
```
NETLIFY_AUTH_TOKEN             # Web deployment
```

#### Android - Debug APK (Already Configured)
```
ANDROID_KEYSTORE_BASE64        # Debug keystore
ANDROID_KEYSTORE_PASSWORD      # stellardescent
ANDROID_KEY_ALIAS              # stellardescent-debug
ANDROID_KEY_PASSWORD           # stellardescent
```

#### Android - Google Play (Production)
```
GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64
ANDROID_RELEASE_KEYSTORE_BASE64
ANDROID_RELEASE_KEYSTORE_PASSWORD
ANDROID_RELEASE_KEY_ALIAS
ANDROID_RELEASE_KEY_PASSWORD
```

#### iOS - App Store / TestFlight
```
APPLE_API_KEY_ID
APPLE_API_ISSUER_ID
APPLE_API_KEY_BASE64
APPLE_TEAM_ID
MATCH_PASSWORD
MATCH_GIT_URL
MATCH_GIT_BASIC_AUTH           # Optional
```

#### Steam
```
STEAM_USERNAME
STEAM_CONFIG_VDF_BASE64
```

#### Desktop Signing (Optional)
```
WIN_CSC_LINK
WIN_CSC_KEY_PASSWORD
CSC_LINK                       # macOS
CSC_KEY_PASSWORD               # macOS
```

### Repository Variables (Not Secrets)
```
STEAM_APP_ID
STEAM_DEPOT_WINDOWS
STEAM_DEPOT_MACOS
STEAM_DEPOT_LINUX
```

---

## Release Workflow

When you push to main and Release Please creates a release:

1. **Web** → Netlify production deploy + GitHub Release (zip)
2. **Android APK** → GitHub Release (debug APKs)
3. **Android AAB** → Google Play Internal track
4. **iOS** → TestFlight upload
5. **Steam** → Beta branch (all platforms in parallel)
6. **Desktop** → GitHub Release (installers)

### Promotion Flow

```
                    ┌─────────────────┐
                    │   Code Merged   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Release Created │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌────────▼────────┐  ┌───────▼───────┐
│  Google Play  │   │    TestFlight   │  │     Steam     │
│   Internal    │   │    Internal     │  │     Beta      │
└───────┬───────┘   └────────┬────────┘  └───────┬───────┘
        │                    │                    │
        │ Manual             │ Manual             │ Manual
        │ Promotion          │ Promotion          │ Promotion
        │                    │                    │
┌───────▼───────┐   ┌────────▼────────┐  ┌───────▼───────┐
│  Google Play  │   │    TestFlight   │  │     Steam     │
│  Open Beta    │   │    External     │  │    Default    │
└───────┬───────┘   └────────┬────────┘  └───────────────┘
        │                    │
        │ Manual             │ Manual
        │ Promotion          │ Submission
        │                    │
┌───────▼───────┐   ┌────────▼────────┐
│  Google Play  │   │    App Store    │
│  Production   │   │    Release      │
└───────────────┘   └─────────────────┘
```

---

## Checklist

### Before First Release
- [ ] Netlify site configured
- [ ] Apple Developer Program enrolled
- [ ] Google Play Developer account created
- [ ] Steamworks account created and app configured
- [ ] All GitHub secrets configured
- [ ] Match certificates repository created
- [ ] Production Android keystore generated
- [ ] App store listings completed (screenshots, descriptions)

### Per Release
- [ ] Changelog updated
- [ ] Version bumped (handled by Release Please)
- [ ] All platforms building successfully
- [ ] Beta testing completed
- [ ] Promote to production (manual step)
