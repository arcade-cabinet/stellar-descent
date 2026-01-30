# STELLAR DESCENT: PROXIMA BREACH

A sophisticated, mobile-first arcade shooter built with modern web technologies. Set in humanity's first interstellar frontier, you play as Sergeant James Cole, a Space Marine dropping onto an alien world to find your missing brother and eliminate a hostile alien threat.

![Game Status](https://img.shields.io/badge/status-alpha-orange)
![Platform](https://img.shields.io/badge/platform-web-blue)
![Mobile](https://img.shields.io/badge/mobile-supported-green)

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
| **BabylonJS** | 8.x | 3D rendering (WebGPU/WebGL2) |
| **Havok Physics** | 1.3.x | Physics simulation |
| **Yuka** | 0.7.x | AI steering behaviors |
| **AnimeJS** | 4.x | UI animations |
| **Miniplex** | 2.x | Entity Component System |
| **SQL.js** | 1.13.x | Persistent world storage |
| **Biome** | 2.3.x | Linting & formatting |
| **Vite** | 6.x | Build tooling |
| **TypeScript** | 5.9.x | Type safety |

## Features

### Gameplay
- **First-person shooter** mechanics with smooth controls
- **Procedural world generation** with radial chunk loading
- **Persistent world state** via SQLite (areas remember their state)
- **AI-driven enemies** with patrol, chase, attack, and flee behaviors
- **Mech allies** that assist in boss battles
- **Mission-based progression** with story chapters

### Technical
- **WebGPU with WebGL2 fallback** for broad compatibility
- **Mobile-first responsive design** works on phones, tablets, foldables, and desktop
- **Virtual joystick controls** for touch devices
- **HDR rendering pipeline** with bloom, tone mapping, and chromatic aberration
- **Entity Component System** for efficient game object management

### Visual Design
- **Military tactical aesthetic** (olive, khaki, brass - no cyberpunk)
- **Harsh alien sunlight** with high-contrast HDR visuals
- **Consistent design token system** for UI theming

## Controls

### Desktop
| Key | Action |
|-----|--------|
| W/A/S/D | Movement |
| Mouse | Aim/Look |
| Left Click | Fire |
| Shift | Sprint |
| ESC | Pause |

### Mobile/Touch
| Control | Action |
|---------|--------|
| Left Joystick | Movement |
| Right Joystick | Aim/Look |
| Fire Button | Shoot |
| Run Button | Sprint |

## Project Structure

```text
src/
├── app.ts                 # Application entry point
├── css/
│   └── main.css          # Global styles (mobile-first)
├── game/
│   ├── core/
│   │   ├── ecs.ts        # Entity Component System
│   │   ├── gameManager.ts # Main game orchestration
│   │   └── lore.ts       # Story, characters, missions
│   ├── db/
│   │   └── worldDatabase.ts # SQLite persistence
│   ├── entities/
│   │   ├── mech.ts       # Mech ally class
│   │   └── player.ts     # Player controller
│   ├── systems/
│   │   ├── aiSystem.ts   # Yuka-based AI
│   │   └── combatSystem.ts # Combat & projectiles
│   ├── ui/
│   │   ├── hud.ts        # In-game HUD
│   │   ├── introSequence.ts # Story intro
│   │   ├── mainMenu.ts   # Main menu
│   │   └── touchControls.ts # Mobile controls
│   ├── utils/
│   │   ├── designTokens.ts # Color/spacing system
│   │   └── responsive.ts  # Mobile utilities
│   └── world/
│       ├── chunkManager.ts # Procedural generation
│       └── terrainGenerator.ts # Terrain creation
└── types/
    └── animejs.d.ts      # Type definitions
```

## Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](./AGENTS.md) | Instructions for AI agents |
| [docs/DESIGN.md](./docs/DESIGN.md) | Design decisions & UI/UX |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical architecture |
| [docs/LORE.md](./docs/LORE.md) | Complete game lore & story |
| [docs/DEVLOG.md](./docs/DEVLOG.md) | Development log & roadmap |
| [docs/TESTING.md](./docs/TESTING.md) | Testing guide & infrastructure |

## Development

### Prerequisites
- Node.js 18+
- pnpm 10.2+

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
pnpm test:e2e     # Run E2E tests
pnpm test:all     # Run all tests

# Production
pnpm build        # Build for production
pnpm preview      # Preview production build
```

### Browser Support
- Chrome 113+ (WebGPU)
- Firefox 115+ (WebGL2 fallback)
- Safari 17+ (WebGL2)
- Mobile Safari iOS 17+
- Chrome Android 113+

## Story Synopsis

**Year 3147.** Humanity has spread to the Alpha Centauri system. You are Sergeant James Cole of the 7th Drop Marines, deployed to Proxima Centauri b ("Kepler's Promise") to investigate the disappearance of Recon Team Vanguard - including your brother Marcus.

What you find is an alien threat emerging from underground: the Chitin, an insectoid hive species controlled by a queen. Fight through the hostile surface, link up with Marcus in his combat mech, and descend into the hive to eliminate the queen once and for all.

## Chapters

1. **Prologue** - Mission briefing aboard ANCHOR STATION PROMETHEUS
2. **The Drop** - Tutorial and orbital insertion
3. **Kepler's Promise** - Surface exploration and combat
4. **FOB Delta** - Investigate the silent outpost
5. **Brothers in Arms** - Team up with Marcus
6. **Into the Breach** - Assault the hive
7. **Extraction** - Survive to the pickup point

## License

MIT License - See [LICENSE](./LICENSE) for details.

## Credits

- **Engine**: [BabylonJS](https://www.babylonjs.com/)
- **Physics**: [Havok](https://www.havok.com/)
- **AI**: [Yuka](https://mugen87.github.io/yuka/)
- **Template**: [bp800](https://github.com/eldinor/bp800)
- **Textures**: [BabylonJS Asset Library](https://doc.babylonjs.com/toolsAndResources/assetLibraries/availableTextures)

---

*"Find them. Bring them home. Or avenge them."*
— Commander Vasquez, PROMETHEUS ACTUAL
