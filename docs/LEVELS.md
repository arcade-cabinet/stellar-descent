# STELLAR DESCENT: Level System Architecture

This document defines the complete level system architecture, mapping the story chapters from LORE.md to playable game levels, and establishing the technical contracts for level implementation.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Campaign Structure](#campaign-structure)
3. [Level Architecture](#level-architecture)
4. [HUD System](#hud-system)
5. [Dynamic Action Buttons](#dynamic-action-buttons)
6. [Quest and Marker System](#quest-and-marker-system)
7. [Input and Keybindings](#input-and-keybindings)
8. [Level Implementation Guide](#level-implementation-guide)
9. [Level Specifications](#level-specifications)
10. [Timer and Best Times](#timer-and-best-times)

---

## Design Philosophy

### Core Principles

**1. Scene Isolation (Like HALO)**
Each level is a completely self-contained experience:
- Own Babylon.js Scene instance
- Own lighting, skybox, and atmosphere
- Own asset loading and disposal
- Clean transitions between levels
- NO merged scenes or shared geometry

**2. Linked List Navigation**
Levels form a doubly-linked list, not an array:
```
anchor_station <-> landfall <-> canyon_run <-> fob_delta <-> brothers_in_arms
                                                                     |
southern_ice <-> the_breach <-> hive_assault <-> extraction <-> final_escape
```
Each level knows only its `nextLevelId` and `previousLevelId`.

**3. Universal HUD Overlay**
The HUD is a React component that floats ABOVE all levels:
- Health bar (always visible during gameplay)
- Mission text (context-sensitive)
- Kill counter (when applicable)
- Crosshair (FPS mode only)
- Dynamic action buttons (level-controlled)
- Comms display (narrative delivery)
- Notifications (events/achievements)
- Timer display (level elapsed time)

**4. Progressive Unlocking**
Tutorial (Anchor Station) progressively unlocks HUD elements:
- Movement first -> health bar appears
- Look around -> crosshair appears
- Weapon training -> ammo counter appears
- Action tutorial -> action buttons explained
- Full HUD unlocked by level end

---

## Campaign Structure

### 10-Level Campaign Overview

| Act | Level ID | Chapter | Level Type | Environment |
|:----|:---------|:--------|:-----------|:------------|
| **ACT 1: THE DROP** | `anchor_station` | 1 | station | Space station interior |
| | `landfall` | 2 | drop -> canyon | HALO drop -> planet surface |
| **ACT 2: THE SEARCH** | `canyon_run` | 3 | vehicle | Vehicle chase through canyons |
| | `fob_delta` | 4 | base | Abandoned military outpost |
| | `brothers_in_arms` | 5 | brothers | Open world, mech combat |
| **ACT 3: THE TRUTH** | `southern_ice` | 6 | ice | Frozen wasteland |
| | `the_breach` | 7 | hive | Underground alien tunnels |
| **ACT 4: ENDGAME** | `hive_assault` | 8 | combined_arms | Vehicle + infantry |
| | `extraction` | 9 | extraction | Surface holdout |
| | `final_escape` | 10 | finale | Vehicle escape -> victory |

### Level Flow Diagram

```
+-----------------------------------------------------------------------------+
|                           STELLAR DESCENT CAMPAIGN                           |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +------------------+     +------------------+     +------------------+     |
|  | ANCHOR STATION   |---->|     LANDFALL     |---->|   CANYON RUN     |     |
|  |   (Tutorial)     |     |   (HALO Drop)    |     | (Vehicle Chase)  |     |
|  |   Chapter 1      |     |    Chapter 2     |     |   Chapter 3      |     |
|  +------------------+     +------------------+     +------------------+     |
|                                                           |                 |
|                                                           v                 |
|  +------------------+     +------------------+     +------------------+     |
|  | BROTHERS IN ARMS |<----|    FOB DELTA     |<----|                  |     |
|  |  (Mech Combat)   |     |   (Horror/Inv)   |                             |
|  |   Chapter 5      |     |    Chapter 4     |                             |
|  +------------------+     +------------------+                             |
|          |                                                                  |
|          v                                                                  |
|  +------------------+     +------------------+     +------------------+     |
|  |  SOUTHERN ICE    |---->|   THE BREACH     |---->|  HIVE ASSAULT    |     |
|  | (Ice Variants)   |     | (Queen Boss)     |     | (Combined Arms)  |     |
|  |   Chapter 6      |     |   Chapter 7      |     |   Chapter 8      |     |
|  +------------------+     +------------------+     +------------------+     |
|                                                           |                 |
|                                                           v                 |
|                           +------------------+     +------------------+     |
|                           |   FINAL ESCAPE   |<----|   EXTRACTION     |     |
|                           | (Vehicle Finale) |     |  (Wave Holdout)  |     |
|                           |   Chapter 10     |     |   Chapter 9      |     |
|                           +------------------+     +------------------+     |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Level Architecture

### Technical Structure

```typescript
// Each level implements ILevel interface
interface ILevel {
  readonly id: LevelId;
  readonly type: LevelType;
  readonly config: LevelConfig;

  // Lifecycle
  initialize(): Promise<void>;
  update(deltaTime: number): void;
  dispose(): void;

  // Scene access (isolated per level)
  getScene(): Scene;

  // State management
  getState(): LevelState;
  setState(state: Partial<LevelState>): void;

  // Input
  lockPointer(): void;
  unlockPointer(): void;
  isPointerLocked(): boolean;
  setTouchInput(input: TouchInputState | null): void;

  // Navigation
  canTransitionTo(levelId: LevelId): boolean;
  prepareTransition(targetLevelId: LevelId): Promise<void>;
}
```

### Level Types

| Type | Description | Camera | Combat | Example |
|:-----|:------------|:-------|:-------|:--------|
| `station` | Interior space station | FPS | Limited/Tutorial | Anchor Station |
| `drop` | HALO descent sequence | Special (down->forward) | Dodge/Avoid | Landfall (phase 1) |
| `canyon` | Exterior planet surface | FPS | Full | Landfall (phase 2) |
| `vehicle` | Vehicle chase/driving | Third-person | Vehicle weapons | Canyon Run |
| `base` | Abandoned outpost interior | FPS | Ambush | FOB Delta |
| `brothers` | Open canyon with mech ally | FPS | Full + ally support | Brothers in Arms |
| `ice` | Frozen wasteland | FPS | Full + ice hazards | Southern Ice |
| `hive` | Underground alien tunnels | FPS | Heavy + boss | The Breach |
| `combined_arms` | Vehicle + infantry | Mixed | Full | Hive Assault |
| `extraction` | Holdout/escape | FPS | Wave-based | Extraction |
| `finale` | Timed vehicle escape | Third-person | Obstacles | Final Escape |

### Scene Isolation Rules

1. **Each level creates its own `new Scene(engine)`**
2. **Levels dispose their scene on cleanup**
3. **No global meshes shared between levels**
4. **Assets loaded per-level (with caching at engine level)**
5. **Skybox/environment completely level-specific**
6. **Lighting designed for each level's atmosphere**

---

## HUD System

### HUD Component Hierarchy

```
+-------------------------------------------------------------+
|                         HUD OVERLAY                          |
|                    (React, always on top)                    |
+-------------------------------------------------------------+
|                                                              |
|  +-------------+              +----------------------+       |
|  | Health Bar  |              |    Mission Text      |       |
|  | (bottom-L)  |              |    (top-center)      |       |
|  +-------------+              +----------------------+       |
|                                                              |
|                   +----------+        +-------------+        |
|  +-------+        | Crosshair|        |Kill Counter |        |
|  | Timer |        | (center) |        | (top-right) |        |
|  |(top-L)|        +----------+        +-------------+        |
|  +-------+                                                   |
|                                                              |
|  +---------------+              +---------------------+      |
|  | Action Btns   |              |   Action Buttons    |      |
|  | (left panel)  |              |   (right panel)     |      |
|  +---------------+              +---------------------+      |
|                                                              |
|              +-------------------------------+               |
|              |       Action Buttons          |               |
|              |       (bottom panel)          |               |
|              +-------------------------------+               |
|                                                              |
|  +----------------------------------------------------------+|
|  |                   Comms Display                           ||
|  |                 (bottom, modal)                           ||
|  +----------------------------------------------------------+|
|                                                              |
+-------------------------------------------------------------+
```

### HUD Visibility States

```typescript
interface HUDVisibility {
  healthBar: boolean;      // Unlocked: movement tutorial
  crosshair: boolean;      // Unlocked: look tutorial
  killCounter: boolean;    // Unlocked: first kill
  missionText: boolean;    // Unlocked: first objective
  actionButtons: boolean;  // Unlocked: action tutorial
  commsDisplay: boolean;   // Always available (narrative)
  notifications: boolean;  // Always available
  timer: boolean;          // Shown during timed sections
}
```

---

## Timer and Best Times

### Timer System

Each level tracks completion time for speedrunning:

```typescript
interface LevelTimer {
  startTime: number;       // When level started (ms)
  elapsedTime: number;     // Current elapsed time (ms)
  isPaused: boolean;       // Timer paused (pause menu)
  isComplete: boolean;     // Level finished
}
```

### Best Times Persistence

Best times are stored in the save file:

```typescript
interface GameSave {
  // ...
  levelBestTimes: Partial<Record<LevelId, number>>;  // Best time in seconds
}

// Recording a time
const isNewBest = saveSystem.recordLevelTime('anchor_station', 125.5);
if (isNewBest) {
  notify('NEW BEST TIME!');
}
```

### Timer Display

- Shows elapsed time in `MM:SS.ms` format
- Pauses when game is paused
- Best time shown on level completion screen
- New best time celebration effect

---

## Level Specifications

### Level 1: Anchor Station (`anchor_station`)

**Act**: ACT 1: THE DROP
**Chapter**: 1
**Type**: `station`
**Duration**: 5-10 minutes

**Setting**:
- Interior of ANCHOR STATION PROMETHEUS
- Clean, industrial military aesthetic
- Artificial gravity, artificial lighting
- Large windows showing planet below

**Key Objectives**:
1. Attend briefing (story delivery)
2. Navigate to Equipment Bay (movement tutorial)
3. Equip ODST suit (interaction tutorial)
4. Complete weapon familiarization (combat tutorial)
5. Proceed to Hangar Bay (navigation)
6. Board drop pod (level complete)

**Collectibles**:
- 1 Secret area
- 2 Audio logs

---

### Level 2: Landfall (`landfall`)

**Act**: ACT 1: THE DROP
**Chapter**: 2
**Type**: `drop` -> `canyon`
**Duration**: 8-12 minutes

**Phases**:
1. **Freefall** (0-30s): Camera looking DOWN at planet
2. **Debris Belt** (30-90s): Dodge asteroids with WASD
3. **Powered Descent** (90-150s): Control jets for landing
4. **Surface Combat**: First Chitin encounters

**Landing Outcomes**:
| Outcome | Condition | Result |
|:--------|:----------|:-------|
| Perfect | On pad, low velocity | Clean start, bonus |
| Near Miss | Close to pad | Fight to LZ |
| Rough | Far from pad | Damage, heavy combat |
| Crash | High velocity | Major damage, near death |

**Collectibles**:
- 2 Secret areas
- 2 Audio logs

---

### Level 3: Canyon Run (`canyon_run`)

**Act**: ACT 2: THE SEARCH
**Chapter**: 3
**Type**: `vehicle`
**Duration**: 8-12 minutes

**Setting**:
- Northern Canyon system
- High-speed vehicle chase
- Narrow canyon corridors

**Key Events**:
1. Find functional survey vehicle
2. Chase through canyon
3. Environmental hazards (rockfalls, acid pools)
4. Brute encounter (first appearance)
5. Vehicle destroyed, continue on foot

**Collectibles**:
- 2 Secret areas
- 1 Audio log

---

### Level 4: FOB Delta (`fob_delta`)

**Act**: ACT 2: THE SEARCH
**Chapter**: 4
**Type**: `base`
**Duration**: 10-15 minutes

**Setting**:
- Abandoned military outpost
- Power flickering/offline
- Horror atmosphere

**Areas**:
1. Perimeter - Breached barriers
2. Courtyard - Overturned vehicles
3. Barracks - Personal effects, bodies
4. Command Center - Mission logs
5. Vehicle Bay - Marcus's mech signature
6. Underground Access - Exit to The Breach

**Collectibles**:
- 3 Secret areas
- 3 Audio logs

---

### Level 5: Brothers in Arms (`brothers_in_arms`)

**Act**: ACT 2: THE SEARCH
**Chapter**: 5
**Type**: `brothers`
**Duration**: 12-18 minutes

**Setting**:
- Open canyon terrain
- Marcus's mech as AI ally
- Wave-based combat

**Key Moments**:
1. Cinematic reunion with Marcus
2. Fight together (mech provides support)
3. Wave-based defense
4. Discover The Breach entrance

**Collectibles**:
- 2 Secret areas
- 2 Audio logs

---

### Level 6: Southern Ice (`southern_ice`)

**Act**: ACT 3: THE TRUTH
**Chapter**: 6
**Type**: `ice`
**Duration**: 10-15 minutes

**Setting**:
- Frozen wasteland
- Ice fields, frozen fog
- New Chitin variants (ice-adapted)

**Environmental Hazards**:
- Hypothermia exposure
- Ice surfaces (affect movement)
- Cryogenic spitter projectiles

**New Enemy Types**:
- Ice Chitin (hardened carapaces)
- Cryo-spitters (freeze projectiles)
- Ice burrowers

**Collectibles**:
- 3 Secret areas
- 2 Audio logs

---

### Level 7: The Breach (`the_breach`)

**Act**: ACT 3: THE TRUTH
**Chapter**: 7
**Type**: `hive`
**Duration**: 15-20 minutes

**Setting**:
- Underground alien tunnels
- Bioluminescent architecture
- Queen's Chamber at bottom

**Structure**:
1. Upper Hive - Scout territory
2. Mid Hive - Maze tunnels
3. Lower Hive - Egg chambers
4. Queen's Chamber - Boss arena

**Queen Boss Fight**:
- Health: 5000 HP
- 3 phases with increasing difficulty
- Spawns minions throughout
- Weak point on abdomen between phases

**Collectibles**:
- 3 Secret areas
- 2 Audio logs

---

### Level 8: Hive Assault (`hive_assault`)

**Act**: ACT 4: ENDGAME
**Chapter**: 8
**Type**: `combined_arms`
**Duration**: 12-15 minutes

**Setting**:
- Surface above The Breach
- Collapsing hive network
- Combined vehicle + infantry combat

**Key Events**:
1. Emerge from collapsing hive
2. Fight alongside Marcus's mech
3. Supply drops from orbit
4. Push to extraction point

**Collectibles**:
- 2 Secret areas
- 1 Audio log

---

### Level 9: Extraction (`extraction`)

**Act**: ACT 4: ENDGAME
**Chapter**: 9
**Type**: `extraction`
**Duration**: 8-12 minutes

**Setting**:
- LZ Omega clearing
- Hasty barricades
- Dropship ETA countdown

**Wave Structure**:
1. Skitterer swarms
2. Lurker assault
3. Acid rain (spitters)
4. Combined arms
5. Broodmother + Brutes
6. Husk swarms
7. Everything at once

**Collectibles**:
- 2 Secret areas
- 1 Audio log

---

### Level 10: Final Escape (`final_escape`)

**Act**: ACT 4: ENDGAME
**Chapter**: 10
**Type**: `finale`
**Duration**: 5-8 minutes

**Setting**:
- Collapsing terrain
- Vehicle escape sequence
- Dropship as destination

**Key Moments**:
1. Board salvaged vehicle
2. Race through disintegrating terrain
3. Canyon walls collapse
4. Bridge crossing
5. Jump across sinkhole
6. Sprint to dropship
7. Victory!

**Collectibles**:
- 1 Secret area
- 1 Audio log

---

## Level Implementation Guide

### Creating a New Level

1. **Create level directory**: `src/game/levels/{level-name}/`

2. **Extend BaseLevel**:
```typescript
export class MyLevel extends BaseLevel {
  protected getBackgroundColor(): Color4 {
    return new Color4(/* level-specific color */);
  }

  protected async createEnvironment(): Promise<void> {
    // Create all meshes, lights, etc.
  }

  protected updateLevel(deltaTime: number): void {
    // Update game logic each frame
  }

  protected disposeLevel(): void {
    // Clean up level-specific resources
  }
}
```

3. **Register factory** in `factories.ts`

4. **Add to CAMPAIGN_LEVELS** in `types.ts`

### Level Checklist

- [ ] Extends BaseLevel properly
- [ ] Own Scene created (via super())
- [ ] Level-specific lighting setup
- [ ] Skybox/background appropriate
- [ ] Action buttons configured per phase
- [ ] Quest markers for objectives
- [ ] Comms messages for narrative
- [ ] Timer tracking implemented
- [ ] State saved on exit
- [ ] Clean dispose() implementation
- [ ] Transition conditions defined
- [ ] Collectibles placed

---

## Integration Notes

### GameContext Integration

Levels communicate with the HUD via callbacks:

```typescript
callbacks.onActionGroupsChange(groups);     // Update action buttons
callbacks.onActionHandlerRegister(handler); // Register button handler
callbacks.onObjectiveUpdate(title, text);   // Update mission display
callbacks.onCommsMessage(message);          // Show narrative
callbacks.onNotification(text, duration);   // Toast notification
callbacks.onHealthChange(health);           // Update health bar
callbacks.onCombatStateChange(inCombat);    // Combat music trigger
callbacks.onLevelComplete(nextLevelId);     // Level complete
```

### Level Transition Flow

```
Level A completes
    |
    v
callbacks.onLevelComplete(nextLevelId)
    |
    v
LevelManager.transitionTo(nextLevelId)
    |
    v
Level A.prepareTransition() - fade out, save state
    |
    v
Level A.dispose() - cleanup
    |
    v
Level B = factory.create(config)
    |
    v
Level B.initialize() - load assets, create scene
    |
    v
Level B active
```

---

*"Find them. Bring them home. Or avenge them."*
-- Commander Elena Vasquez
