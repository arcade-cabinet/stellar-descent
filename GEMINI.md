# Gemini Memory & Context

This document serves as the integration point for Gemini's memory systems. It aligns the project's agentic documentation with the Memory Bank structure.

## Core Mandates

- **Read the Memory Bank**: Before starting any task, read `docs/MEMORY.md` and the referenced files in `docs/memory-bank/`.
- **Update the Memory Bank**: As you evolve the project, ensure the Memory Bank reflects the latest state.
- **Respect AGENTS.md**: Follow the specific project rules and agent guidelines in `AGENTS.md`.

## Memory Bank Location

The primary source of truth for project context is located at:
**[docs/MEMORY.md](docs/MEMORY.md)**

## Active Memories

- The user prioritizes "doing it right" (proper architecture, strict types, no band-aids) over speed.
- **NO FALLBACKS** - Code should fail fast and explicitly.
- **Mobile-first**: All UI and controls must work on phones first.
- **Military aesthetic**: Olive, khaki, brass colors. NO cyberpunk.
- **BabylonJS**: WebGL2 only, no WebGPU fallback complexity. No `anime.js` for Babylon objects (use manual loops).
- **Testing**: Vitest for unit tests, Playwright for E2E.
