# Codebase Modularization Plan

**Project**: Stellar Descent
**Date**: 2026-01-30
**Priority**: High - Technical debt is impacting maintainability and development velocity

## Executive Summary

The codebase contains 20+ files exceeding 1000 lines, with 8 critical files over 2000 lines. Level files are the worst offenders, with multiple concerns (environment, combat, enemies, audio, cinematics, UI) mixed into single monolithic classes. This document provides a prioritized refactoring plan using the existing modularization patterns already established in the codebase.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Existing Good Patterns to Follow](#2-existing-good-patterns-to-follow)
3. [Modularization Strategy](#3-modularization-strategy)
4. [Priority 1: Critical Level Files (2000+ lines)](#4-priority-1-critical-level-files)
5. [Priority 2: Large Audio/Core Files (1500+ lines)](#5-priority-2-large-audiocore-files)
6. [Priority 3: Remaining Large Files (1000-1500 lines)](#6-priority-3-remaining-large-files)
7. [Implementation Phases](#7-implementation-phases)
8. [Risk Mitigation](#8-risk-mitigation)

---

## 1. Current State Analysis

### Critical Monoliths (2000+ lines)

| File | Lines | Mixed Concerns |
|------|-------|----------------|
| `extraction/ExtractionLevel.ts` | 4306 | 5 phases, wave combat, mech AI, dropship, collapse effects, environment |
| `landfall/LandfallLevel.ts` | 4046 | HALO drop, asteroid dodging, powered descent, surface combat, particles |
| `core/AudioManager.ts` | 3603 | 85+ sound types, music, procedural audio, spatial audio, level configs |
| `fob-delta/FOBDeltaLevel.ts` | 3133 | 6 areas, horror ambush, enemy AI, terminal interaction, flashlight |
| `brothers-in-arms/BrothersInArmsLevel.ts` | 2594 | Marcus mech, 4 waves, cinematics, enemy spawning, terrain |
| `core/EnvironmentalAudioManager.ts` | 2428 | 5 environment types, spatial sources, zones, occlusion |
| `mining-depths/MiningDepthsLevel.ts` | 2072 | 3 sections, burrower enemies, boss fight, hazards |
| `hive-assault/environment.ts` | 2017 | 4 battlefield layers, GLB placement, terrain, fortifications |

### Large Files (1000-2000 lines)

| File | Lines | Primary Concerns |
|------|-------|------------------|
| `core/WeaponSoundManager.ts` | 1601 | Per-weapon procedural audio (AR, SMG, Plasma), feedback sounds |
| `the-breach/TheBreachLevel.ts` | 1493 | 4 hive zones, Queen boss, enemy spawning (already partially modularized) |
| `southern-ice/SouthernIceLevel.ts` | 1485 | 3 phases, temperature system, Ice Chitin enemies |
| `core/CombatMusicManager.ts` | 1365 | Combat state detection, music transitions, intensity layers |
| `core/PerformanceManager.ts` | 1337 | FPS monitoring, quality adaptation, LOD management |
| `effects/WeatherSystem.ts` | 1241 | 4 weather types, particles, lighting, fog |
| `core/LODManager.ts` | 1150 | Distance-based LOD, culling, instancing |
| `canyon-run/CanyonRunLevel.ts` | 1143 | Vehicle chase, 3 phases, Wraith enemies, bridge collapse |
| `BaseLevel.ts` | 1122 | Camera, input, post-processing, shake, weather integration |
| `achievements/AchievementManager.ts` | 1082 | 50+ achievements, tracking, persistence |
| `components/ui/SettingsMenu.tsx` | 1039 | Graphics, audio, controls, accessibility settings |

---

## 2. Existing Good Patterns to Follow

The codebase already has excellent modularization patterns to emulate:

### Pattern A: the-breach/ Submodule Structure

```
src/game/levels/the-breach/
  TheBreachLevel.ts   -- Main level class (1493 lines, orchestration only)
  comms.ts            -- COMMS messages and OBJECTIVES constants
  constants.ts        -- Numeric constants, damage values, timings
  enemies.ts          -- Enemy spawning, AI, hit detection, preloading
  environment.ts      -- HiveEnvironmentBuilder, asset placement
  hazards.ts          -- Acid pools, egg clusters, pheromone clouds
  queen.ts            -- Boss creation, phases, attacks, animations
  types.ts            -- Interfaces for Enemy, Queen, LevelPhase, etc.
  index.ts            -- Public exports
```

**Why it works**: Each file has a single responsibility. The main level file orchestrates but delegates to specialized modules.

### Pattern B: brothers-in-arms/ AI Separation

```
src/game/levels/brothers-in-arms/
  BrothersInArmsLevel.ts      -- Main level class
  MarcusCombatAI.ts           -- Marcus targeting, firing, movement
  MarcusCombatCoordinator.ts  -- Player-Marcus tactical coordination
  marcusBanter.ts             -- Situational dialogue system
  cinematics.ts               -- Reunion sequence, cutscene triggers
  BattlefieldEnvironment.ts   -- GLB-based arena construction
```

**Why it works**: AI systems, dialogue, cinematics, and environment are each isolated.

### Pattern C: shared/ Reusable Builders

```
src/game/levels/shared/
  AlienFloraBuilder.ts       -- Flora placement across all levels
  CollectiblePlacer.ts       -- Audio logs, secrets, skulls
  HiveEnvironmentBuilder.ts  -- Organic tunnel/chamber construction
  ModularBaseBuilder.ts      -- Military base corridor segments
  SpawnManager.ts            -- Generic enemy spawning
  SpawnConfig.ts             -- Spawn point definitions
  SurfaceTerrainFactory.ts   -- Procedural terrain with presets
  types.ts                   -- Shared type definitions
```

**Why it works**: Cross-cutting concerns are centralized and reused by multiple levels.

---

## 3. Modularization Strategy

### Principles

1. **Single Responsibility**: Each file should do one thing well
2. **Delegate, Don't Duplicate**: Level classes orchestrate; specialized modules execute
3. **Extract Constants First**: Move comms, objectives, and numeric constants immediately
4. **Extract Types Second**: Create explicit interfaces for all data structures
5. **Extract Pure Functions Third**: Combat math, AI decisions, hit detection
6. **Extract Stateful Systems Last**: Environment builders, enemy managers

### Target File Size

- **Level main file**: 500-800 lines (orchestration and phase management)
- **Submodules**: 200-400 lines each (single concern)
- **Shared utilities**: 100-300 lines (pure functions)

### Naming Conventions

```
{LevelName}Level.ts         -- Main level class
{LevelName}Environment.ts   -- Environment building and GLB placement
{LevelName}Enemies.ts       -- Enemy spawning, AI, types
{LevelName}Combat.ts        -- Player combat actions, damage, weapons
{LevelName}Cinematics.ts    -- Cutscenes, scripted sequences
{LevelName}Audio.ts         -- Level-specific audio setup
comms.ts                    -- Dialogue and objectives
constants.ts                -- Numeric constants
types.ts                    -- Type definitions
```

---

## 4. Priority 1: Critical Level Files

### 4.1 ExtractionLevel.ts (4306 lines) -> Target: 600 lines

**Current structure**: Single monolithic class with 5 phases, wave combat, mech AI, dropship arrival, and hive collapse sequence.

**Proposed submodules**:

```
src/game/levels/extraction/
  ExtractionLevel.ts          -- Phase orchestration only (~600 lines)
  ExtractionEnvironment.ts    -- Already exists (GLB-based LZ Omega)
  EscapeTunnelBuilder.ts      -- Collapse wall, debris, tunnel segments (~250 lines)
  WaveCombatSystem.ts         -- Wave configs, spawn timing, enemy management (~400 lines)
  MarcusMechAI.ts             -- Mech positioning, firing, damage tracking (~200 lines)
  DropshipSequence.ts         -- Arrival animation, ramp, boarding (~300 lines)
  HiveCollapseEffects.ts      -- Ground cracks, eruptions, stalactites (~350 lines)
  comms.ts                    -- Wave announcements, Marcus dialogue (~100 lines)
  constants.ts                -- Timers, radii, cooldowns (~50 lines)
  types.ts                    -- ExtractionPhase, WaveConfig, Enemy, etc. (~80 lines)
  index.ts                    -- Public exports
```

**Extraction order**:
1. Extract `comms.ts` and `constants.ts` (trivial, immediate wins)
2. Extract `types.ts` with all interfaces
3. Extract `WaveCombatSystem.ts` (most complex, highest value)
4. Extract `HiveCollapseEffects.ts` (self-contained visual system)
5. Extract `DropshipSequence.ts` (scripted animation sequence)
6. Extract `MarcusMechAI.ts` (stateful but isolated)
7. Extract `EscapeTunnelBuilder.ts` (environment construction)

**Dependencies**:
- `WaveCombatSystem` uses `shared/SpawnManager` patterns
- `MarcusMechAI` follows `brothers-in-arms/MarcusCombatAI` pattern
- `HiveCollapseEffects` follows `effects/WeatherSystem` pattern

---

### 4.2 LandfallLevel.ts (4046 lines) -> Target: 550 lines

**Current structure**: HALO drop sequence (freefall, asteroid belt, powered descent) + surface combat.

**Proposed submodules**:

```
src/game/levels/landfall/
  LandfallLevel.ts             -- Phase orchestration (~550 lines)
  LandfallEnvironment.ts       -- Already exists (GLB environment)
  FreefallController.ts        -- Freefall physics, camera, arms pose (~300 lines)
  AsteroidBeltSystem.ts        -- Asteroid spawning, dodging, collisions (~350 lines)
  PoweredDescentController.ts  -- Thrust physics, fuel, targeting LZ (~300 lines)
  ReentryEffects.ts            -- Plasma glow, particles, heat distortion (~250 lines)
  AnchorStationVisual.ts       -- Station GLB assembly, receding effect (~200 lines)
  SurfaceCombat.ts             -- Post-landing enemy combat (~300 lines)
  comms.ts                     -- Drop dialogue, warnings (~80 lines)
  constants.ts                 -- FOV values, speeds, damage (~50 lines)
  types.ts                     -- DropPhase, Asteroid, LandingOutcome (~60 lines)
  index.ts
```

**Extraction order**:
1. Extract `comms.ts`, `constants.ts`, `types.ts`
2. Extract `AnchorStationVisual.ts` (self-contained GLB assembly)
3. Extract `ReentryEffects.ts` (particle systems, visual-only)
4. Extract `AsteroidBeltSystem.ts` (gameplay mechanic, high complexity)
5. Extract `FreefallController.ts` and `PoweredDescentController.ts`
6. Extract `SurfaceCombat.ts`

---

### 4.3 AudioManager.ts (3603 lines) -> Target: 400 lines

**Current structure**: Monolithic singleton handling 85+ sound effect types, music playback, procedural audio generation, and level-specific audio configs.

**Proposed submodules**:

```
src/game/core/audio/
  AudioManager.ts              -- Coordinator, volume, mute state (~400 lines)
  ProceduralAudio.ts           -- Web Audio API sound generation (~350 lines)
  MusicPlayer.ts               -- Track loading, crossfade, looping (~250 lines)
  SoundEffectPlayer.ts         -- Sound effect playback, pooling (~200 lines)
  LevelAudioConfigs.ts         -- Per-level audio profiles (~150 lines)
  SpatialAudioController.ts    -- 3D positioned sounds, panning (~300 lines)
  AudioTypes.ts                -- SoundEffect, MusicTrack, LevelAudioConfig (~100 lines)
  index.ts
```

**Extraction order**:
1. Extract `AudioTypes.ts` and `LevelAudioConfigs.ts` (pure data)
2. Extract `ProceduralAudio.ts` (the existing class inside AudioManager)
3. Extract `MusicPlayer.ts` (track loading, crossfade logic)
4. Extract `SpatialAudioController.ts` (3D audio integration)
5. Extract `SoundEffectPlayer.ts` (simple playback)
6. Refactor `AudioManager.ts` as thin coordinator

---

### 4.4 FOBDeltaLevel.ts (3133 lines) -> Target: 600 lines

**Current structure**: Horror-themed abandoned base with 6 areas, enemy ambush, terminal interaction, and flashlight system.

**Proposed submodules**:

```
src/game/levels/fob-delta/
  FOBDeltaLevel.ts             -- Phase orchestration (~600 lines)
  FOBEnvironment.ts            -- GLB-based base construction (~400 lines)
  AmbushEnemyManager.ts        -- Lurker spawning and AI (~250 lines)
  FlickerLightSystem.ts        -- Horror lighting effects (~150 lines)
  TerminalInteraction.ts       -- Log reading, keycard, mech signature (~200 lines)
  FlashlightController.ts      -- Player flashlight mechanics (~100 lines)
  HorrorAtmosphere.ts          -- Blood decals, jump scares, audio (~200 lines)
  comms.ts                     -- Investigation dialogue (~80 lines)
  constants.ts                 -- Area radii, damage values (~50 lines)
  types.ts                     -- FOBPhase, AreaZone, FlickerLight (~60 lines)
  index.ts
```

---

### 4.5 BrothersInArmsLevel.ts (2594 lines) -> Target: 500 lines

**Already partially modularized** with `MarcusCombatAI.ts`, `MarcusCombatCoordinator.ts`, `cinematics.ts`, `marcusBanter.ts`, and `BattlefieldEnvironment.ts`.

**Remaining extractions**:

```
src/game/levels/brothers-in-arms/
  WaveEnemySystem.ts           -- Enemy spawning per wave (~300 lines)
  BreachEnvironment.ts         -- The Breach sinkhole visuals (~150 lines)
  comms.ts                     -- Wave announcements, dialogue (~80 lines)
  constants.ts                 -- Enemy configs, wave configs (~100 lines)
  types.ts                     -- Consolidate existing types (~80 lines)
```

---

### 4.6 EnvironmentalAudioManager.ts (2428 lines) -> Target: 400 lines

**Current structure**: Handles 5 environment types with multiple audio layers, spatial sources, zones, and occlusion.

**Proposed submodules**:

```
src/game/core/audio/environmental/
  EnvironmentalAudioManager.ts   -- Coordinator (~400 lines)
  StationEnvironment.ts          -- Station-specific layers (~200 lines)
  SurfaceEnvironment.ts          -- Outdoor wind, thunder (~200 lines)
  HiveEnvironment.ts             -- Organic pulsing, alien sounds (~200 lines)
  BaseEnvironment.ts             -- Horror ambient, creaks (~200 lines)
  ExtractionEnvironment.ts       -- Urgent rumbles, explosions (~150 lines)
  SpatialSoundSource.ts          -- Individual sound source logic (~150 lines)
  AudioZoneManager.ts            -- Zone transitions, reverb (~200 lines)
  OcclusionSystem.ts             -- Wall blocking, filtering (~150 lines)
  types.ts                       -- EnvironmentType, AudioZone, etc. (~80 lines)
  index.ts
```

---

### 4.7 MiningDepthsLevel.ts (2072 lines) -> Target: 500 lines

**Proposed submodules**:

```
src/game/levels/mining-depths/
  MiningDepthsLevel.ts          -- Phase orchestration (~500 lines)
  MiningEnvironment.ts          -- Already has environment.ts, extend it
  BurrowerEnemyManager.ts       -- Burrower spawning, emerge/burrow AI (~300 lines)
  DrillChitinBoss.ts            -- Boss attacks, phases, enrage (~350 lines)
  HazardManager.ts              -- Gas vents, unstable ground, floods (~250 lines)
  FlickerLightSystem.ts         -- Reuse or share with FOB Delta
  comms.ts                      -- Reyes dialogue, warnings (~80 lines)
  constants.ts                  -- Boss HP, damage, section bounds (~60 lines)
  types.ts                      -- MiningPhase, BurrowerEnemy, DrillChitinBoss (~80 lines)
  index.ts
```

---

### 4.8 hive-assault/environment.ts (2017 lines) -> Target: 300 lines

**Current structure**: Single file building 4 battlefield layers with many GLB placements.

**Proposed split**:

```
src/game/levels/hive-assault/environment/
  AssaultEnvironmentBuilder.ts   -- Coordinator class (~300 lines)
  StagingAreaBuilder.ts          -- FOB structures, perimeter (~300 lines)
  OpenFieldBuilder.ts            -- Barricades, wrecks, turrets (~300 lines)
  BreachPointBuilder.ts          -- Military/organic barrier merge (~250 lines)
  HiveEntranceBuilder.ts         -- Organic gate, bio-lights, vents (~300 lines)
  FleetBackdropBuilder.ts        -- Sky spaceships (~100 lines)
  types.ts                       -- StagingAreaProps, AATurret, etc. (~80 lines)
  index.ts
```

---

## 5. Priority 2: Large Audio/Core Files

### 5.1 WeaponSoundManager.ts (1601 lines) -> Target: 300 lines

**Proposed split**:

```
src/game/core/audio/weapons/
  WeaponSoundManager.ts          -- Coordinator, environment switching (~300 lines)
  AssaultRifleSounds.ts          -- AR fire variations, reload (~200 lines)
  SMGSounds.ts                   -- SMG fire variations (~200 lines)
  PlasmaCannonSounds.ts          -- Plasma charge, discharge (~250 lines)
  ShotgunSounds.ts               -- If exists (~200 lines)
  FeedbackSounds.ts              -- Hit markers, headshots, kill confirm (~150 lines)
  ImpactSounds.ts                -- Surface-specific impacts (~150 lines)
  types.ts                       -- WeaponId, EnvironmentType, ImpactSurface (~50 lines)
  index.ts
```

### 5.2 CombatMusicManager.ts (1365 lines) -> Target: 300 lines

**Proposed split**:

```
src/game/core/audio/music/
  CombatMusicManager.ts          -- State machine, intensity (~300 lines)
  CombatStateDetector.ts         -- Enemy proximity, health, etc. (~200 lines)
  LayeredMusicPlayer.ts          -- Intensity layers, blending (~250 lines)
  MusicTransitions.ts            -- Crossfade, stinger triggers (~200 lines)
  types.ts                       -- CombatIntensity, MusicLayer (~50 lines)
  index.ts
```

### 5.3 PerformanceManager.ts (1337 lines) -> Target: 300 lines

**Proposed split**:

```
src/game/core/performance/
  PerformanceManager.ts          -- Coordinator (~300 lines)
  FPSMonitor.ts                  -- Frame time tracking, averaging (~150 lines)
  QualityAdapter.ts              -- Dynamic quality adjustment (~250 lines)
  RenderBudget.ts                -- Draw call limits, triangle budgets (~200 lines)
  MemoryMonitor.ts               -- Texture/mesh memory tracking (~150 lines)
  types.ts                       -- QualityLevel, PerformanceMetrics (~50 lines)
  index.ts
```

---

## 6. Priority 3: Remaining Large Files

### 6.1 TheBreachLevel.ts (1493 lines)

**Already well-modularized**. Remaining work:
- Move Queen boss fight methods to `queen.ts` if not already there
- Consider splitting enemy spawning into `enemies.ts` further

### 6.2 SouthernIceLevel.ts (1485 lines) -> Target: 500 lines

**Proposed submodules**:

```
src/game/levels/southern-ice/
  SouthernIceLevel.ts            -- Phase orchestration (~500 lines)
  environment.ts                 -- Already exists, enhance
  IceChitin.ts                   -- Already exists (enemy type)
  TemperatureSystem.ts           -- Exposure meter, damage, warmth zones (~200 lines)
  BlizzardController.ts          -- Particle intensity, visibility (~150 lines)
  MarcusOverwatch.ts             -- Cold-resistant mech support (~150 lines)
  comms.ts                       -- Temperature warnings, phase dialogue (~100 lines)
  constants.ts                   -- Exposure rates, phase triggers (~60 lines)
  types.ts                       -- LevelPhase, TemperatureZone (~60 lines)
  index.ts
```

### 6.3 WeatherSystem.ts (1241 lines) -> Target: 300 lines

**Proposed split**:

```
src/game/effects/weather/
  WeatherSystem.ts               -- Coordinator (~300 lines)
  RainEffect.ts                  -- Rain particles, puddles (~200 lines)
  SnowEffect.ts                  -- Snow particles, accumulation (~200 lines)
  DustStormEffect.ts             -- Dust particles, visibility (~200 lines)
  FogController.ts               -- Dynamic fog density (~150 lines)
  WeatherLighting.ts             -- Sky color, ambient changes (~150 lines)
  types.ts                       -- WeatherType, WeatherIntensity (~50 lines)
  index.ts
```

### 6.4 LODManager.ts (1150 lines) -> Target: 300 lines

**Proposed split**:

```
src/game/core/rendering/
  LODManager.ts                  -- Coordinator (~300 lines)
  DistanceLOD.ts                 -- Distance-based mesh switching (~200 lines)
  CullingSystem.ts               -- Frustum and occlusion culling (~200 lines)
  InstanceManager.ts             -- Mesh instancing optimization (~200 lines)
  LODPresets.ts                  -- Quality-level configurations (~100 lines)
  types.ts                       -- LODLevel, CullResult (~50 lines)
  index.ts
```

### 6.5 CanyonRunLevel.ts (1143 lines) -> Target: 500 lines

**Proposed submodules**:

```
src/game/levels/canyon-run/
  CanyonRunLevel.ts              -- Phase orchestration (~500 lines)
  VehicleController.ts           -- Already exists
  environment.ts                 -- Already exists
  WraithEnemyManager.ts          -- Wraith spawning, pursuit AI (~250 lines)
  BridgeCollapseSequence.ts      -- Scripted bridge destruction (~150 lines)
  comms.ts                       -- Chase dialogue (~80 lines)
  constants.ts                   -- Speeds, damage, trigger points (~60 lines)
  types.ts                       -- CanyonPhase, EnemyWraith (~60 lines)
  index.ts
```

### 6.6 BaseLevel.ts (1122 lines)

**Partially acceptable size** given it's the base class for all levels. Consider:
- Extract `CameraShakeSystem.ts` (~100 lines)
- Extract `InputHandler.ts` (~150 lines)
- Extract `PostProcessingSetup.ts` (~100 lines)

### 6.7 AchievementManager.ts (1082 lines) -> Target: 400 lines

**Proposed split**:

```
src/game/achievements/
  AchievementManager.ts          -- Coordinator, unlock logic (~400 lines)
  AchievementDefinitions.ts      -- All 50+ achievement configs (~300 lines)
  AchievementTrackers.ts         -- Kill counters, time trackers (~200 lines)
  AchievementPersistence.ts      -- Save/load unlocked achievements (~100 lines)
  types.ts                       -- Achievement, AchievementCategory (~50 lines)
  index.ts
```

### 6.8 SettingsMenu.tsx (1039 lines) -> Target: 300 lines

**Proposed split**:

```
src/components/ui/settings/
  SettingsMenu.tsx               -- Tab container (~200 lines)
  GraphicsSettings.tsx           -- Resolution, quality, effects (~200 lines)
  AudioSettings.tsx              -- Volume sliders, mute toggles (~150 lines)
  ControlsSettings.tsx           -- Keybindings, sensitivity (~200 lines)
  AccessibilitySettings.tsx      -- Subtitles, colorblind modes (~150 lines)
  SettingsContext.tsx            -- State management (~100 lines)
  index.ts
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Extract types, constants, and pure functions from Priority 1 files

1. Create `types.ts` and `constants.ts` for all 8 critical files
2. Create `comms.ts` dialogue files for all levels
3. No behavioral changes - purely structural moves
4. Establish import patterns and barrel exports

**Estimated effort**: 16-24 hours
**Risk**: Low (no logic changes)

### Phase 2: Environment Builders (Week 2-3)
**Goal**: Extract environment construction into dedicated builders

1. `ExtractionLevel` -> `EscapeTunnelBuilder.ts`
2. `LandfallLevel` -> `AnchorStationVisual.ts`
3. `FOBDeltaLevel` -> `FOBEnvironment.ts`
4. `hive-assault/environment.ts` -> split into 5 builders

**Estimated effort**: 20-30 hours
**Risk**: Medium (constructor/initialization order)

### Phase 3: Combat Systems (Week 3-4)
**Goal**: Extract enemy management and combat logic

1. `ExtractionLevel` -> `WaveCombatSystem.ts`
2. `LandfallLevel` -> `SurfaceCombat.ts`, `AsteroidBeltSystem.ts`
3. `FOBDeltaLevel` -> `AmbushEnemyManager.ts`
4. `MiningDepthsLevel` -> `BurrowerEnemyManager.ts`, `DrillChitinBoss.ts`

**Estimated effort**: 30-40 hours
**Risk**: High (state management, timing)

### Phase 4: Audio Refactor (Week 4-5)
**Goal**: Split AudioManager and related systems

1. `AudioManager.ts` -> 6 submodules
2. `EnvironmentalAudioManager.ts` -> 9 submodules
3. `WeaponSoundManager.ts` -> 8 submodules
4. `CombatMusicManager.ts` -> 5 submodules

**Estimated effort**: 24-32 hours
**Risk**: Medium (audio context management)

### Phase 5: Visual Effects (Week 5-6)
**Goal**: Extract particle systems and visual effects

1. `LandfallLevel` -> `ReentryEffects.ts`
2. `ExtractionLevel` -> `HiveCollapseEffects.ts`
3. `WeatherSystem.ts` -> 6 submodules
4. `SouthernIceLevel` -> `BlizzardController.ts`, `TemperatureSystem.ts`

**Estimated effort**: 20-28 hours
**Risk**: Medium (particle system lifecycle)

### Phase 6: Core Systems (Week 6-7)
**Goal**: Refactor performance and rendering systems

1. `PerformanceManager.ts` -> 5 submodules
2. `LODManager.ts` -> 5 submodules
3. `AchievementManager.ts` -> 4 submodules
4. `BaseLevel.ts` -> extract shake, input, post-processing

**Estimated effort**: 20-28 hours
**Risk**: Medium (singleton patterns, global state)

### Phase 7: UI Components (Week 7-8)
**Goal**: Split large React components

1. `SettingsMenu.tsx` -> 6 subcomponents

**Estimated effort**: 8-12 hours
**Risk**: Low (React component composition)

---

## 8. Risk Mitigation

### Testing Strategy

1. **Before each extraction**: Write integration tests covering the functionality being moved
2. **After each extraction**: Run full test suite, verify no regressions
3. **Manual testing**: Play through each level after extraction

### Rollback Plan

1. Each extraction should be a single commit
2. Use feature branches for each phase
3. Keep original file available during transition period

### Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| Circular imports | Use barrel exports, dependency injection |
| State sharing | Pass state via constructor/method params |
| Event subscriptions | Document cleanup requirements |
| Audio context issues | Ensure single AudioContext lifetime |
| Babylon.js disposal | Track all meshes/materials for cleanup |

### Dependency Graph Validation

Before each extraction, verify:
1. No circular dependencies introduced
2. Shared state is properly passed
3. Event subscriptions are transferred
4. Cleanup/disposal is maintained

---

## Appendix: File-by-File Dependency Map

### ExtractionLevel Dependencies

```
ExtractionLevel
  -> BaseLevel (extends)
  -> shared/HiveEnvironmentBuilder
  -> shared/SurfaceTerrainFactory
  -> shared/AlienFloraBuilder
  -> shared/CollectiblePlacer
  -> ExtractionEnvironmentBuilder (exists)
  -> core/AudioManager
  -> core/AssetManager
  -> effects/ParticleManager
  -> entities/aliens (createAlienMesh)
  -> achievements
```

### AudioManager Dependencies

```
AudioManager
  -> EnvironmentalAudioManager
  -> ProceduralMusicEngine
  -> WeaponSoundManager
  -> levels/types (LevelId)
  -> entities/weapons (WeaponId)
```

### Cross-Cutting Concerns

These modules are used by multiple levels and should remain in `shared/`:
- `AlienFloraBuilder.ts`
- `CollectiblePlacer.ts`
- `HiveEnvironmentBuilder.ts`
- `ModularBaseBuilder.ts`
- `SpawnManager.ts`
- `SurfaceTerrainFactory.ts`

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Files over 2000 lines | 8 | 0 |
| Files over 1000 lines | 20+ | 3-4 |
| Average level file size | 2500 lines | 500 lines |
| Max cyclomatic complexity | High | Medium |
| Time to understand a level | 30+ min | 10 min |
| Time to add new feature | Hours | Minutes |

---

*Document authored: 2026-01-30*
*Estimated total effort: 150-200 hours*
*Recommended timeline: 8 weeks*
