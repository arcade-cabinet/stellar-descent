# Active Context

## Current Development Phase
**Phase 3: Tutorial & Story** (In Progress)

## Recent Work (Session 4 - Jan 30, 2026)
- **Testing Infrastructure**: Added Vitest (unit) and Playwright (E2E) testing.
- **Shooting Range Mini-Game**: Implemented weapons calibration sequence in the tutorial.
- **Tutorial Polish**: Expanded tutorial flow with equipment interaction, hangar depressurization, and launch sequence.
- **Loading Screen**: Fixed fake loading to use real asset loading progress.

## Immediate Priorities
1. **First-person view**: Add gloved hands holding weapon models.
2. **HALO drop polish**: Visualize the planet during descent; lock camera looking down.
3. **Weapon System**: Implement functional weapon switching (Rifle, Pistol, Grenade).
4. **View Bobbing**: Add head bob while walking for immersion.
5. **Sound Effects**: Add audio for suit equip, depressurization, doors, and launch.
6. **E2E Tests**: Expand coverage for full playthroughs.

## Active Decisions
- **Modular Levels**: Levels are self-contained packages (e.g., `src/game/levels/anchor-station/`) to avoid monolithic files.
- **Ref-Based Updates**: The render loop uses `useRef` values to avoid stale closures in React state.
- **Touch Controls**: Redesigned to "DOOM-style" - left joystick move, screen drag look, right side buttons.
- **No Anime.js for Babylon**: Strictly enforced. Use manual `requestAnimationFrame` loops.

## Known Issues
- **Camera Sync**: Needs verification when syncing player turning with camera.
- **Touch Testing**: Needs validation on real physical devices.
- **Drop Sequence**: Transition needs visual polish.
