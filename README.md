# STELLAR DESCENT: PROXIMA BREACH

A sophisticated, mobile-first arcade shooter built with modern web technologies. Set in humanity's first interstellar frontier, you play as Sergeant James Cole, a Space Marine dropping onto an alien world to find your missing brother and eliminate a hostile alien threat.

![Game Status](https://img.shields.io/badge/status-beta-yellow)
![Platform](https://img.shields.io/badge/platform-web%20|%20iOS%20|%20Android-blue)
![Mobile](https://img.shields.io/badge/mobile-supported-green)
![PWA](https://img.shields.io/badge/PWA-enabled-purple)

## Quick Start

This project uses `pnpm` for package management.

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Technology Stack

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **BabylonJS** | 8.x | 3D rendering (WebGL2) |
| **Havok Physics** | 1.3.x | Physics simulation |
| **Yuka** | 0.7.x | AI steering behaviors |
| **Tone.js** | 15.x | Audio and music system |
| **AnimeJS** | 4.x | UI animations |
| **Miniplex** | 2.x | Entity Component System |
| **Capacitor** | 8.x | Native iOS/Android apps |
| **Biome** | 2.3.x | Linting and formatting |
| **Vite** | 7.x | Build tooling |
| **TypeScript** | 5.9.x | Type safety |
| **React** | 19.x | UI components |

## Features

### Gameplay

- **First-person shooter** mechanics with smooth controls
- **10-level campaign** across 4 acts with boss battles
- **Vehicle sequences** including vehicle chases and escapes
- **AI-driven enemies** with patrol, chase, attack, and flee behaviors
- **Mech ally** (Marcus) that assists in battle
- **Mission timer** with level best times tracking
- **Difficulty settings** (Easy, Normal, Hard, Nightmare)
- **Achievement system** with unlockable challenges

### Technical

- **WebGL2 rendering** for broad compatibility
- **Progressive Web App (PWA)** with offline support
- **Native mobile apps** via Capacitor (iOS and Android)
- **Mobile-first responsive design** works on phones, tablets, foldables, and desktop
- **Virtual joystick controls** for touch devices
- **HDR rendering pipeline** with bloom, tone mapping, and chromatic aberration
- **Entity Component System** for efficient game object management
- **Save system v4** with level progress, best times, and difficulty

### Save System

- **Auto-save** on level completion
- **Level best times** tracking for speedrunning
- **Difficulty persistence** across sessions
- **Progress tracking** for levels visited and completed
- **IndexedDB storage** for PWA offline support

### Accessibility

- **Touch controls** with configurable sensitivity
- **Keyboard rebinding** support
- **Reduced motion** support
- **Screen reader** friendly UI

## Controls

### Desktop

| Key | Action |
|-----|--------|
| W/A/S/D | Movement |
| Mouse | Aim/Look |
| Left Click | Fire |
| R | Reload |
| Shift | Sprint |
| Space | Jump |
| E | Interact |
| ESC | Pause |

### Mobile/Touch

| Control | Action |
|---------|--------|
| Left Joystick | Movement |
| Screen Drag | Aim/Look |
| Fire Button | Shoot |
| Run Button | Sprint |
| Jump Button | Jump |

## Project Structure

```text
src/
├── App.tsx                 # Application entry point
├── components/
│   ├── GameCanvas.tsx      # Main game renderer
│   └── ui/                 # React UI components
├── css/
│   └── main.css            # Global styles (mobile-first)
├── game/
│   ├── context/            # React contexts (Player, Combat, Mission)
│   ├── core/               # Core systems (ECS, GameManager, Performance)
│   ├── entities/           # Game entities (player, aliens, mech)
│   ├── levels/             # Level implementations (10 levels)
│   ├── persistence/        # Save system (GameSave, SaveSystem)
│   ├── systems/            # ECS systems (AI, combat)
│   └── world/              # World generation (chunks, terrain)
├── hooks/                  # Custom React hooks
└── types/                  # TypeScript type definitions
```

## Campaign Structure

The game features a 10-level campaign across 4 acts:

| Act | Level | Chapter | Description |
|-----|-------|---------|-------------|
| **ACT 1: THE DROP** | Anchor Station | 1 | Tutorial and mission briefing |
| | Landfall | 2 | HALO drop and first surface combat |
| **ACT 2: THE SEARCH** | Canyon Run | 3 | Vehicle chase through canyons |
| | FOB Delta | 4 | Horror investigation at abandoned base |
| | Brothers in Arms | 5 | Reunite with Marcus, mech combat |
| **ACT 3: THE TRUTH** | Southern Ice | 6 | Frozen wasteland, ice Chitin variants |
| | The Breach | 7 | Underground hive, Queen boss fight |
| **ACT 4: ENDGAME** | Hive Assault | 8 | Combined arms assault |
| | Extraction | 9 | Wave-based holdout at LZ Omega |
| | Final Escape | 10 | Vehicle escape as the hive collapses |

## Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](./AGENTS.md) | Instructions for AI agents |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [docs/DESIGN.md](./docs/DESIGN.md) | Design decisions and UI/UX |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical architecture |
| [docs/LEVELS.md](./docs/LEVELS.md) | Level system documentation |
| [docs/LORE.md](./docs/LORE.md) | Complete game lore and story |
| [docs/TESTING.md](./docs/TESTING.md) | Testing guide and infrastructure |
| [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) | Performance optimization guide |
| [docs/DEVLOG.md](./docs/DEVLOG.md) | Development log and roadmap |

## Development

### Prerequisites

- Node.js 22+
- pnpm 10+

### Commands

```bash
# Development
pnpm dev          # Start dev server on port 5173

# Quality
pnpm lint         # Run Biome linter
pnpm format       # Format code with Biome

# Testing
pnpm test         # Run unit tests (watch mode)
pnpm test:run     # Run unit tests once
pnpm test:coverage # Run with coverage report
pnpm test:e2e     # Run Maestro E2E tests
pnpm test:all     # Run all tests

# Production
pnpm build        # Build for production
pnpm preview      # Preview production build

# Mobile (Capacitor)
pnpm build:ios    # Build and sync for iOS
pnpm build:android # Build and sync for Android
pnpm cap:open:ios # Open in Xcode
pnpm cap:open:android # Open in Android Studio
```

### Browser Support

- Chrome 113+ (WebGL2)
- Firefox 115+ (WebGL2)
- Safari 17+ (WebGL2)
- Mobile Safari iOS 17+
- Chrome Android 113+

## Story Synopsis

**Year 3147.** Humanity has spread to the Alpha Centauri system. You are Sergeant James Cole of the 7th Drop Marines, deployed to Proxima Centauri b ("Kepler's Promise") to investigate the disappearance of Recon Team Vanguard - including your brother Marcus.

What you find is an alien threat emerging from underground: the Chitin, an insectoid hive species controlled by a queen. Fight through the hostile surface, link up with Marcus in his combat mech, and descend into the hive to eliminate the queen once and for all.

## Chapters

1. **Anchor Station** - Mission briefing aboard ANCHOR STATION PROMETHEUS
2. **Landfall** - HALO drop and first contact
3. **Canyon Run** - Vehicle chase through hostile terrain
4. **FOB Delta** - Investigate the silent outpost
5. **Brothers in Arms** - Team up with Marcus
6. **Southern Ice** - Traverse the frozen wasteland
7. **The Breach** - Assault the hive and face the Queen
8. **Hive Assault** - Combined arms push
9. **Extraction** - Hold until dropship arrives
10. **Final Escape** - Outrun the collapsing hive

## Deployment

The game is deployed as a PWA to Netlify with GitHub Actions CI/CD:

- **URL**: https://stellar-descent.netlify.app
- **CI/CD**: Automatic deployment on push to main
- **PWA**: Installable on mobile devices

## License

MIT License - See [LICENSE](./LICENSE) for details.

## Credits

- **Engine**: [BabylonJS](https://www.babylonjs.com/)
- **Physics**: [Havok](https://www.havok.com/)
- **AI**: [Yuka](https://mugen87.github.io/yuka/)
- **Audio**: [Tone.js](https://tonejs.github.io/)
- **Template**: [bp800](https://github.com/eldinor/bp800)
- **Textures**: [BabylonJS Asset Library](https://doc.babylonjs.com/toolsAndResources/assetLibraries/availableTextures)

---

*"Find them. Bring them home. Or avenge them."*
-- Commander Vasquez, PROMETHEUS ACTUAL
