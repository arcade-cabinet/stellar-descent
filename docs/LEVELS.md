# STELLAR DESCENT: Level System Architecture

This document defines the complete level system architecture, mapping the story chapters from LORE.md to playable game levels, and establishing the technical contracts for level implementation.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Campaign Structure](#campaign-structure)
3. [Level Architecture](#level-architecture)
4. [HUD System](#hud-system)
5. [Dynamic Action Buttons](#dynamic-action-buttons)
6. [Quest & Marker System](#quest--marker-system)
7. [Input & Keybindings](#input--keybindings)
8. [Level Implementation Guide](#level-implementation-guide)
9. [Level Specifications](#level-specifications)

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
anchor_station <-> landfall <-> fob_delta <-> brothers_in_arms <-> the_breach <-> extraction
      ↑                                                                              ↓
   (start)                                                                        (end)
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

**4. Progressive Unlocking**
Tutorial (Anchor Station) progressively unlocks HUD elements:
- Movement first → health bar appears
- Look around → crosshair appears
- Weapon training → ammo counter appears
- Action tutorial → action buttons explained
- Full HUD unlocked by level end

---

## Campaign Structure

### Mapping Lore Chapters to Levels

| Lore Chapter | Level ID | Level Type | Environment |
|:-------------|:---------|:-----------|:------------|
| Prologue + Chapter 1 | `anchor_station` | station | Space station interior |
| Chapter 2 (partial) | `landfall` | drop → canyon | HALO drop → planet surface |
| Chapter 3 | `fob_delta` | base | Abandoned military outpost |
| Chapter 4 | `brothers_in_arms` | canyon | Open world, mech combat |
| Chapter 5 | `the_breach` | hive | Underground alien tunnels |
| Chapter 6 + Epilogue | `extraction` | extraction | Surface holdout → victory |

### Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STELLAR DESCENT CAMPAIGN                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │  ANCHOR STATION  │────▶│     LANDFALL     │────▶│    FOB DELTA     │   │
│  │    (Tutorial)    │     │   (HALO Drop)    │     │   (Horror/Inv)   │   │
│  │   Chapter 1      │     │    Chapter 2     │     │    Chapter 3     │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│                                                              │              │
│                                                              ▼              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │    EXTRACTION    │◀────│    THE BREACH    │◀────│ BROTHERS IN ARMS │   │
│  │  (Final Stand)   │     │ (Hive/Boss Fight)│     │  (Mech Combat)   │   │
│  │    Chapter 6     │     │    Chapter 5     │     │    Chapter 4     │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
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

  // Navigation
  canTransitionTo(levelId: LevelId): boolean;
  prepareTransition(targetLevelId: LevelId): Promise<void>;
}
```

### Level Types

| Type | Description | Camera | Combat | Example |
|:-----|:------------|:-------|:-------|:--------|
| `station` | Interior space station | FPS | Limited/Tutorial | Anchor Station |
| `drop` | HALO descent sequence | Special (down→forward) | Dodge/Avoid | Landfall (phase 1) |
| `canyon` | Exterior planet surface | FPS | Full | Landfall (phase 2), Brothers |
| `base` | Abandoned outpost interior | FPS | Ambush | FOB Delta |
| `hive` | Underground alien tunnels | FPS | Heavy | The Breach |
| `extraction` | Holdout/escape | FPS | Wave-based | Extraction |

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
┌─────────────────────────────────────────────────────────────┐
│                         HUD OVERLAY                         │
│                    (React, always on top)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐              ┌──────────────────────┐ │
│  │   Health Bar    │              │    Mission Text      │ │
│  │  (bottom-left)  │              │    (top-center)      │ │
│  └─────────────────┘              └──────────────────────┘ │
│                                                             │
│                     ┌────────────┐       ┌──────────────┐  │
│                     │  Crosshair │       │ Kill Counter │  │
│                     │  (center)  │       │ (top-right)  │  │
│                     └────────────┘       └──────────────┘  │
│                                                             │
│  ┌─────────────────┐              ┌──────────────────────┐ │
│  │ Action Buttons  │              │   Action Buttons     │ │
│  │ (left panel)    │              │   (right panel)      │ │
│  └─────────────────┘              └──────────────────────┘ │
│                                                             │
│              ┌─────────────────────────────┐               │
│              │     Action Buttons          │               │
│              │     (bottom panel)          │               │
│              └─────────────────────────────┘               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Comms Display                       │  │
│  │                 (bottom, modal)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Notifications                       │  │
│  │                  (center, toast)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
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
}
```

### Tutorial Unlock Sequence

1. **Start**: Only notifications visible
2. **Movement Tutorial**: Health bar fades in
3. **Look Tutorial**: Crosshair appears
4. **Weapon Tutorial**: Ammo counter (future)
5. **Action Tutorial**: Action buttons explained
6. **Shooting Range**: Kill counter appears
7. **Mission Start**: Full HUD unlocked

---

## Dynamic Action Buttons

### Architecture

Levels control which action buttons appear via callbacks:

```typescript
// Level calls this to update HUD action buttons
callbacks.onActionGroupsChange(groups: ActionButtonGroup[]);

// Level registers handler for button presses
callbacks.onActionHandlerRegister(handler: (actionId: string) => void);
```

### ActionButtonGroup Structure

```typescript
interface ActionButtonGroup {
  id: string;
  label?: string;                    // Group header (optional)
  position: 'left' | 'right' | 'bottom';
  buttons: ActionButton[];
}

interface ActionButton {
  id: string;                        // Unique action identifier
  label: string;                     // Display text
  key: string;                       // Keyboard binding (e.g., 'Space', 'KeyE')
  keyDisplay: string;                // What to show user (e.g., 'SPACE', 'E')
  enabled: boolean;                  // Can be triggered?
  visible: boolean;                  // Is it shown?
  highlighted?: boolean;             // Pulsing attention effect
  cooldown?: number;                 // Total cooldown time (ms)
  cooldownRemaining?: number;        // Current remaining (ms)
  progress?: number;                 // 0-1 for progress bar
  progressColor?: string;            // Color of progress bar
  variant?: 'primary' | 'secondary' | 'danger' | 'warning';
  size?: 'small' | 'medium' | 'large';
  icon?: string;                     // Emoji or icon character
}
```

### Level-Specific Action Sets

#### Anchor Station (Tutorial)
```typescript
// Phase 1: Movement only - no buttons
[]

// Phase 2: Suit equip
[{
  id: 'suit',
  position: 'right',
  buttons: [
    { id: 'equip_suit', label: 'EQUIP SUIT', key: 'KeyE', highlighted: true }
  ]
}]

// Phase 3: Shooting range
[{
  id: 'weapons',
  position: 'right',
  buttons: [
    { id: 'fire', label: 'FIRE', key: 'Mouse0' },
    { id: 'reload', label: 'RELOAD', key: 'KeyR' }
  ]
}]

// Phase 4: Ready for drop
[{
  id: 'mission',
  position: 'bottom',
  buttons: [
    { id: 'begin_drop', label: 'BEGIN ORBITAL DROP', key: 'Space', variant: 'danger', size: 'large' }
  ]
}]
```

#### Landfall (HALO Drop)
```typescript
// Phase 1: Freefall - no buttons (WASD dodge)
[]

// Phase 2: Post-debris, awaiting jets
[{
  id: 'jets',
  position: 'right',
  buttons: [
    { id: 'ignite_jets', label: 'IGNITE JETS', key: 'Space', variant: 'danger', highlighted: true }
  ]
}]

// Phase 3: Powered descent
[{
  id: 'thrusters',
  position: 'right',
  buttons: [
    { id: 'boost', label: 'BOOST', key: 'Space', variant: 'primary' },
    { id: 'stabilize', label: 'STABILIZE', key: 'KeyQ', variant: 'secondary' },
    { id: 'brake', label: 'BRAKE', key: 'KeyE', variant: 'warning' }
  ]
}]

// Phase 4: Surface combat
[{
  id: 'combat',
  position: 'right',
  buttons: [
    { id: 'grenade', label: 'GRENADE', key: 'KeyG', cooldown: 5000 },
    { id: 'melee', label: 'MELEE', key: 'KeyV' }
  ]
}]
```

---

## Quest & Marker System

### Marker Types

| Marker | Icon | Color | Usage |
|:-------|:-----|:------|:------|
| Main Objective | `!` | Gold | Primary mission goals |
| Optional | `?` | Blue | Side objectives |
| Interact | `[E]` | White | Interactable objects |
| Enemy | `▲` | Red | Hostile targets (optional) |
| Ally | `♦` | Green | Friendly NPCs |
| Waypoint | `◆` | Yellow | Navigation points |

### Marker Implementation

```typescript
interface QuestMarker {
  id: string;
  type: 'main' | 'optional' | 'interact' | 'enemy' | 'ally' | 'waypoint';
  position: Vector3;
  visible: boolean;
  distanceVisible: number;    // Max distance to show (meters)
  showDistance: boolean;      // Show "42m" below marker
  pulseEffect: boolean;       // Attention-grabbing pulse
  label?: string;             // Optional text label
  attachedTo?: Entity;        // Follow an entity
}
```

### Visibility Rules

1. **Distance Culling**: Markers fade at `distanceVisible`
2. **Occlusion**: Markers show through walls (gameplay clarity > realism)
3. **Screen Edge**: Off-screen markers show as edge indicators
4. **Priority**: Main > Optional > Interact for overlapping markers

---

## Input & Keybindings

### Default Keyboard Bindings

| Action | Primary | Secondary | Description |
|:-------|:--------|:----------|:------------|
| Move Forward | W | ↑ | Move forward |
| Move Back | S | ↓ | Move backward |
| Strafe Left | A | ← | Move left |
| Strafe Right | D | → | Move right |
| Look | Mouse | - | Aim/look around |
| Fire | Left Click | - | Primary weapon fire |
| Aim/Zoom | Right Click | - | Aim down sights |
| Reload | R | - | Reload weapon |
| Interact | E | - | Use/interact |
| Jump | Space | - | Jump |
| Crouch | Ctrl | C | Crouch/duck |
| Sprint | Shift | - | Run faster |
| Grenade | G | - | Throw grenade |
| Melee | V | - | Melee attack |
| Menu/Pause | Escape | - | Pause game |

### Keybinding System

```typescript
interface KeybindingConfig {
  action: string;
  primary: string;      // Key code (e.g., 'KeyW', 'ArrowUp')
  secondary?: string;   // Alternative binding
  category: 'movement' | 'combat' | 'interaction' | 'ui';
}

// Settings stored in localStorage
interface UserSettings {
  keybindings: KeybindingConfig[];
  mouseSensitivity: number;
  invertY: boolean;
  // ...
}
```

### Settings Menu Requirements

**Desktop/Laptop Only** (keyboard detected):
- Full keybinding customization
- Mouse sensitivity slider
- Invert Y-axis toggle
- Key conflict detection

**Touch-Only Devices**:
- NO keybinding section (irrelevant)
- Touch sensitivity settings
- Control layout options

**Detection Logic**:
```typescript
const hasKeyboard = () => {
  // Check for physical keyboard
  return !('ontouchstart' in window) ||
         window.matchMedia('(pointer: fine)').matches;
};
```

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
- [ ] State saved on exit
- [ ] Clean dispose() implementation
- [ ] Transition conditions defined

---

## Level Specifications

### Level 1: Anchor Station (`anchor_station`)

**Lore Reference**: Prologue + Chapter 1
**Type**: `station`
**Duration**: 5-10 minutes

**Setting**:
- Interior of ANCHOR STATION PROMETHEUS
- Clean, industrial military aesthetic
- Artificial gravity, artificial lighting
- Large windows showing planet below

**Rooms/Areas**:
1. **Briefing Room** - Starting point, Commander Vasquez hologram
2. **Corridor A** - Main walkway with crew activity
3. **Equipment Bay** - Suit locker, weapon rack
4. **Shooting Range** - Target practice area
5. **Hangar Bay** - Drop pods visible, final destination

**Key Objectives**:
1. Attend briefing (story delivery)
2. Navigate to Equipment Bay (movement tutorial)
3. Equip ODST suit (interaction tutorial)
4. Complete weapon familiarization (combat tutorial)
5. Proceed to Hangar Bay (navigation)
6. Board drop pod (level complete)

**Progressive Unlocks**:
- Phase 1: Movement only (WASD/arrows)
- Phase 2: Look controls (mouse/touch)
- Phase 3: Interaction (E key)
- Phase 4: Combat basics (shooting range)
- Phase 5: Full HUD, ready for drop

**Assets Required**:
- Station interior geometry (modular corridors, rooms)
- PSX-style textures (metal panels, grating, displays)
- NPCs (static or minimal animation)
- Weapon models (M7 rifle)
- Suit model on rack
- Drop pod interior/exterior

---

### Level 2: Landfall (`landfall`)

**Lore Reference**: Chapter 2
**Type**: `drop` → `canyon`
**Duration**: 8-12 minutes

**Setting**:
- Phase 1: Space, looking down at planet
- Phase 2: Asteroid/debris field (upper atmosphere)
- Phase 3: Powered descent through atmosphere
- Phase 4: Canyon surface, first combat

**Phases**:

#### Phase 1: Freefall Start (0-30 seconds)
- Camera: Looking DOWN at planet
- Arms extended (skydiver pose)
- Planet growing larger below
- Visor HUD elements visible
- No action buttons yet

#### Phase 2: Debris Belt (30-90 seconds)
- Asteroids rushing UP past player
- WASD to dodge (body position)
- Impacts damage suit integrity
- Tension building

#### Phase 3: Powered Descent (90-150 seconds)
- "IGNITE JETS" action button
- Camera transitions to forward view
- Fuel/velocity/position management
- LZ beacon visible
- Multiple landing outcomes

#### Phase 4: Surface (remaining)
- Canyon environment
- First Chitin encounters
- Combat tutorial in action
- Navigate toward FOB Delta marker

**Landing Outcomes**:
| Outcome | Condition | Result |
|:--------|:----------|:-------|
| Perfect | On pad, low velocity | Clean start, bonus |
| Near Miss | Close to pad | Fight to LZ |
| Rough | Far from pad, moderate velocity | Damage, heavy combat |
| Crash | High velocity | Major damage, near death |
| Slingshot | Too far off course | Death, restart |

**Assets Required**:
- Planet sphere (growing during descent)
- Asteroid meshes (varied sizes)
- Arm/glove models (skydiver pose)
- Thruster handle models
- Canyon terrain
- LZ pad geometry
- Chitin enemy models (Drones, Grunts)

---

### Level 3: FOB Delta (`fob_delta`)

**Lore Reference**: Chapter 3
**Type**: `base`
**Duration**: 10-15 minutes

**Setting**:
- Abandoned military outpost
- Power flickering/offline
- Signs of battle (blood, damage, debris)
- Dark, claustrophobic
- Horror atmosphere

**Areas**:
1. **Perimeter** - Breached barriers, entry point
2. **Courtyard** - Central open area, overturned vehicles
3. **Barracks** - Bunks, personal effects, bodies
4. **Command Center** - Terminals, mission logs
5. **Vehicle Bay** - Marcus's mech signature detected
6. **Underground Access** - Exit to The Breach

**Key Objectives**:
1. Breach perimeter
2. Secure courtyard
3. Access command logs (discover what happened)
4. Locate Marcus's signal
5. Survive ambush (first indoor combat)
6. Find underground tunnel entrance

**Atmosphere Elements**:
- Flickering lights
- Environmental storytelling
- Jump scares (carefully placed)
- Motion tracker mechanic introduction
- Increasing dread

**Assets Required**:
- Modular base structures
- Military prefab buildings
- Computer terminals
- Mech (Marcus's Titan visible)
- Barricades, debris
- Blood effects, damage decals
- Chitin corpses (battle aftermath)

---

### Level 4: Brothers in Arms (`brothers_in_arms`)

**Lore Reference**: Chapter 4
**Type**: `canyon`
**Duration**: 12-18 minutes

**Setting**:
- Open canyon environment
- Large combat arena
- Marcus's mech active (AI ally)
- Waves of Chitin

**Key Moments**:
1. Reunion with Marcus (emotional beat)
2. Fight together (mech provides support fire)
3. Search for hive entrance
4. Major battle at The Breach entrance

**Marcus AI**:
- Provides covering fire
- Calls out threats
- Story dialogue during combat lulls
- Cannot enter tunnels (mech too large)

**Unique Mechanics**:
- Mech ally (large-scale support)
- Wave-based combat
- Environmental hazards
- The Breach revealed

**Assets Required**:
- Expanded canyon terrain
- The Breach (massive sinkhole)
- Titan mech (animated, firing)
- Large enemy counts
- Bioluminescent growths (near Breach)

---

### Level 5: The Breach (`the_breach`)

**Lore Reference**: Chapter 5
**Type**: `hive`
**Duration**: 15-20 minutes

**Setting**:
- Underground alien tunnels
- Organic architecture
- Bioluminescent lighting
- **Procedurally generated maze** (seeded for consistency)
- Boss arena at bottom

#### Procedural Maze Generation

The Breach uses `seedrandom` to generate a consistent maze from the level seed:

```typescript
// Maze generation algorithm (recursive backtracking)
interface MazeCell {
  x: number;
  z: number;
  walls: { north: boolean; south: boolean; east: boolean; west: boolean };
  visited: boolean;
  type: 'path' | 'boulder' | 'acid' | 'egg_cluster' | 'chamber';
}

// Generate maze from seed (same seed = same maze)
function generateHiveMaze(seed: string, width: number, height: number): MazeCell[][] {
  const rng = seedrandom(seed);
  const maze: MazeCell[][] = createGrid(width, height);

  // Recursive backtracking for base maze
  carve(maze, 0, 0, rng);

  // Add special cells
  placeBoulders(maze, rng, 0.15);      // 15% chance of boulder obstacles
  placeAcidPools(maze, rng, 0.08);     // 8% chance of acid hazard
  placeEggClusters(maze, rng, 0.10);   // 10% chance of egg clusters
  placeChambers(maze, rng, 3);         // 3 larger chamber rooms

  return maze;
}
```

#### 3D Mesh Generation

Maze cells convert to 3D geometry using merged cubes for performance:

```typescript
// Convert 2D maze to 3D meshes (like QR code tutorial)
function buildMazeMeshes(scene: Scene, maze: MazeCell[][], cellSize: number): Mesh {
  const wallMeshes: Mesh[] = [];

  for (const row of maze) {
    for (const cell of row) {
      // Create wall cubes for each active wall
      if (cell.walls.north) {
        wallMeshes.push(createOrganicWall(scene, cell.x, cell.z, 'north', cellSize));
      }
      // ... other walls
    }
  }

  // CRITICAL: Merge all walls for performance (30fps → 60fps)
  return Mesh.MergeMeshes(wallMeshes, true, true, undefined, false, true);
}
```

#### Drill & Explosives Mechanics

Some maze sections have **boulder blockages** requiring special tools:

```typescript
// Obstacle types and solutions
interface Obstacle {
  type: 'boulder' | 'cave_in' | 'organic_barrier';
  durability: number;      // Health points
  requiredTool: 'drill' | 'explosives' | 'acid_grenade';
  clearTime?: number;      // Seconds for drill
}

// Action buttons for obstacle removal
[{
  id: 'tools',
  label: 'BREACH TOOLS',
  position: 'right',
  buttons: [
    { id: 'drill', label: 'DRILL', key: 'KeyT', cooldown: 2000, icon: '🔧',
      progress: drillProgress, progressColor: '#FFD700' },
    { id: 'explosives', label: 'C4', key: 'KeyC', cooldown: 10000, icon: '💥',
      variant: 'danger', enabled: explosivesCount > 0 }
  ]
}]
```

**Obstacle Types**:
| Type | Solution | Time/Cost | Effect |
|:-----|:---------|:----------|:-------|
| Boulder | Drill | 3 seconds | Silent, attracts no enemies |
| Cave-in | Explosives | Instant | Loud, alerts enemies in 30m radius |
| Organic Barrier | Acid Grenade | Instant | Medium noise, may spawn drones |

#### Marcus AI Signaling System

Marcus stays on the surface with his mech but provides tactical support via radio and signaling:

```typescript
// Right-side HUD for mech commands
[{
  id: 'mech_commands',
  label: 'TITAN LINK',
  position: 'right',
  buttons: [
    { id: 'signal_recon', label: 'RECON', key: 'Digit1', icon: '📡',
      description: 'Marcus scans for hostiles nearby' },
    { id: 'signal_distract', label: 'DISTRACT', key: 'Digit2', icon: '🔊',
      cooldown: 30000, description: 'Mech fires to draw enemies' },
    { id: 'signal_rally', label: 'RALLY', key: 'Digit3', icon: '🎯',
      description: 'Mark waypoint for extraction' }
  ]
}]
```

**Signal Mechanics**:
- **RECON**: Marcus's sensors ping nearby hostiles (mini-map update)
- **DISTRACT**: Mech fires above ground, enemies run toward sound
- **RALLY**: Marcus marks optimal extraction route

#### Platforming Puzzles

The hive includes vertical sections with platforming:

```typescript
// Platforming obstacle types
type PlatformingObstacle =
  | 'acid_gap'       // Jump across acid pool
  | 'collapsed_floor'// Navigate around hole
  | 'organic_bridge' // Unstable, time-limited crossing
  | 'egg_chamber'    // Stealth or fight choice
  | 'vertical_shaft' // Climb/drop with ledges
```

**Areas**:
1. **Tunnel Entrance** - Transition from surface, first drill tutorial
2. **Upper Hive** - Scout area, drones, platforming introduction
3. **Mid Hive** - Maze section with boulders and cave-ins
4. **Lower Hive** - Vertical descent, egg chambers
5. **Queen's Chamber** - Boss arena (hand-crafted, not procedural)

**Queen Boss Fight**:
- **Health**: 5000 HP
- **Phases**: 3 distinct phases
- **Mechanics**:
  - Phase 1: Ranged attacks, spawns drones
  - Phase 2: Melee attacks, spawns grunts
  - Phase 3: Enraged, all attacks faster
- **Victory**: Triggers hive collapse

**Environmental Hazards**:
- Acid pools (damage over time)
- Collapsing tunnels (timed escape)
- Egg clusters (spawn drones if disturbed)
- Pheromone clouds (obscure vision, slow movement)
- Bioluminescent spores (mark player for enemies)

**Assets Required**:
- Organic tunnel meshes (modular for procedural assembly)
- Boulder/cave-in meshes
- Bioluminescent materials
- Queen model (massive, animated)
- Egg cluster models
- All enemy variants
- Drill tool effect (particles, sound)
- Explosion effect for C4

---

### Level 6: Extraction (`extraction`)

**Lore Reference**: Chapter 6 + Epilogue
**Type**: `extraction`
**Duration**: 8-12 minutes

**Setting**:
- Race back to surface
- Collapsing hive behind
- Surface holdout at LZ Omega
- Dropship arrival (victory)

**Phases**:

#### Phase 1: Escape (3-4 minutes)
- Timer pressure
- Collapsing tunnels
- Enemies chasing
- Marcus provides guidance via radio

#### Phase 2: Surface Run (2-3 minutes)
- Open canyon, running
- Chitin pouring from multiple holes
- Marcus's mech providing cover

#### Phase 3: Holdout (3-5 minutes)
- Wave-based defense
- Dropship ETA countdown
- Marcus's mech failing
- Final desperate stand

#### Phase 4: Victory
- Dropship arrives
- Extraction complete
- Epilogue scene
- Credits option

**Unique Mechanics**:
- Timer pressure (collapse)
- Escort/defend Marcus
- Final wave intensity
- Cinematic victory

**Assets Required**:
- Collapsing tunnel effects
- Dropship model
- Victory scene assets
- Epilogue environment (station interior)

---

## Asset Requirements Summary

### PSX-Style Requirements

All assets should follow PSX aesthetic:
- Low polygon counts (500-2000 per model)
- Pixelated textures (64x64 to 256x256)
- Vertex snapping effect (optional)
- Limited color palettes
- No smooth shading (flat or Gouraud)

### Priority Asset List

1. **Player Equipment**
   - Marine armor (first person arms)
   - M7 rifle model
   - Sidearm model

2. **Environments**
   - Station corridor modules
   - Canyon terrain
   - Base prefab buildings
   - Hive tunnel segments

3. **Characters**
   - Marine NPCs (static)
   - Marcus's mech (Titan)
   - Commander Vasquez (hologram)

4. **Enemies**
   - Drone (small, fast)
   - Grunt (medium, standard)
   - Brute (large, slow)
   - Spitter (ranged)
   - Queen (boss)

5. **Props**
   - Crates, barrels
   - Computer terminals
   - Drop pod
   - Weapon racks
   - Mech parts

---

## Integration Notes

### GameContext Integration

Levels communicate with the HUD via GameContext:

```typescript
// From level to HUD
callbacks.onActionGroupsChange(groups);     // Update action buttons
callbacks.onActionHandlerRegister(handler); // Register button handler
callbacks.onObjectiveUpdate(title, text);   // Update mission display
callbacks.onCommsMessage(message);          // Show narrative
callbacks.onNotification(text, duration);   // Toast notification
callbacks.onHealthChange(health);           // Update health bar
callbacks.onCombatStateChange(inCombat);    // Combat music trigger
```

### Level Transition Flow

```
Level A completes
    ↓
callbacks.onLevelComplete(nextLevelId)
    ↓
LevelManager.transitionTo(nextLevelId)
    ↓
Level A.prepareTransition() - fade out, save state
    ↓
Level A.dispose() - cleanup
    ↓
Level B = factory.create(config)
    ↓
Level B.initialize() - load assets, create scene
    ↓
Level B active
```

---

*"Find them. Bring them home. Or avenge them."*
— Commander Elena Vasquez
