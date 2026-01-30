# STELLAR DESCENT: PSX Asset Specifications

This document defines the modular asset system for creating PSX-style environments across all levels. All level builders must reference this document for consistency.

---

## Table of Contents

1. [PSX Aesthetic Rules](#psx-aesthetic-rules)
2. [Unit System](#unit-system)
3. [Modular Architecture Pieces](#modular-architecture-pieces)
4. [Props & Objects](#props--objects)
5. [Characters & Enemies](#characters--enemies)
6. [Materials & Textures](#materials--textures)
7. [Lighting Guidelines](#lighting-guidelines)
8. [Assembly Examples](#assembly-examples)

---

## PSX Aesthetic Rules

### Core Principles

1. **Low Polygon Count**
   - Characters: 200-500 vertices
   - Props: 50-200 vertices
   - Architecture: 100-500 vertices per module
   - Large structures: Build from modules, not single meshes

2. **Texture Resolution**
   - Small props: 32x32 or 64x64
   - Standard objects: 64x64 or 128x128
   - Large surfaces: 128x128 or 256x256
   - NO textures larger than 256x256

3. **Visual Effects**
   - Flat or Gouraud shading (no smooth normals)
   - Vertex snapping (optional, for authentic wobble)
   - Affine texture mapping (optional)
   - Limited color palette per texture (16-64 colors)

4. **Forbidden Elements**
   - High-poly models
   - Normal maps
   - PBR materials
   - Smooth curved surfaces (use faceted approximations)
   - Particle systems with thousands of particles

---

## Unit System

All measurements are in METERS. One unit = one meter.

### Human Scale Reference
```
┌─────────────────────────────────────────┐
│                                         │
│    Standard Marine: 1.8m tall           │
│    Eye height: 1.7m                     │
│    Shoulder width: 0.5m                 │
│                                         │
│    ┌───┐                                │
│    │ ☻ │ ← Head (0.3m)                  │
│    ├───┤                                │
│    │   │ ← Torso (0.6m)                 │
│    │   │                                │
│    ├───┤                                │
│    │   │ ← Legs (0.9m)                  │
│    │   │                                │
│    └───┘                                │
│                                         │
└─────────────────────────────────────────┘
```

### Standard Dimensions

| Element | Size |
|:--------|:-----|
| Door height | 2.2m |
| Door width | 1.2m (single), 2.4m (double) |
| Corridor width | 3-4m |
| Corridor height | 3m |
| Standard room height | 3-4m |
| Large room height | 5-10m |
| Hangar height | 10-15m |
| Step height | 0.2m |
| Railing height | 1.0m |

---

## Modular Architecture Pieces

### Station Interior Modules (Anchor Station)

#### FLOOR MODULES
```
FLOOR_STANDARD (4m x 4m x 0.2m)
├── Material: Metal grating
├── Vertices: ~24
├── Texture: floor_grating.png (128x128)
└── Color: Dark gray (#2A2A2A)

FLOOR_SOLID (4m x 4m x 0.2m)
├── Material: Solid metal plate
├── Vertices: ~8
├── Texture: floor_metal.png (128x128)
└── Color: Medium gray (#404040)

FLOOR_DETAIL (4m x 4m x 0.2m)
├── Material: Patterned metal (warning stripes, etc.)
├── Vertices: ~24
├── Texture: floor_hazard.png (128x128)
└── Color: Yellow/black stripes
```

#### WALL MODULES
```
WALL_STANDARD (4m x 3m x 0.3m)
├── Material: Paneled metal
├── Vertices: ~32
├── Texture: wall_panel.png (128x128)
├── Features: Recessed panel lines
└── Color: Gray-blue (#3A3A4A)

WALL_WINDOW (4m x 3m x 0.3m)
├── Material: Metal frame + viewport
├── Vertices: ~48
├── Texture: wall_panel.png + window transparency
├── Features: Large viewport section
└── Color: Frame gray, window dark blue

WALL_DISPLAY (4m x 3m x 0.3m)
├── Material: Metal with screen area
├── Vertices: ~40
├── Texture: wall_panel.png + display area
├── Features: Built-in display screen
└── Color: Gray frame, green/blue screen

WALL_PIPED (4m x 3m x 0.5m)
├── Material: Metal with exposed pipes
├── Vertices: ~80
├── Texture: wall_industrial.png (128x128)
├── Features: Pipes, valves, gauges
└── Color: Gray, copper pipes

WALL_DOOR (4m x 3m x 0.3m)
├── Material: Metal with door frame
├── Vertices: ~60
├── Texture: wall_panel.png
├── Features: Door frame, door (separate mesh)
└── Color: Gray frame, dark door
```

#### CEILING MODULES
```
CEILING_STANDARD (4m x 4m x 0.2m)
├── Material: Metal panels
├── Vertices: ~16
├── Texture: ceiling_panel.png (128x128)
└── Color: Dark gray (#252525)

CEILING_LIGHT (4m x 4m x 0.3m)
├── Material: Metal with light fixture
├── Vertices: ~32
├── Texture: ceiling_panel.png
├── Features: Recessed light strip
└── Emissive: White/yellow glow
```

#### DOOR MODULES
```
DOOR_SINGLE (1.2m x 2.2m x 0.1m)
├── Material: Heavy metal
├── Vertices: ~24
├── Texture: door_metal.png (64x64)
├── States: Open, closed, locked
└── Color: Dark gray with accent stripe

DOOR_DOUBLE (2.4m x 2.2m x 0.1m)
├── Material: Heavy metal
├── Vertices: ~48
├── Texture: door_metal.png (64x64)
├── States: Open, closed, locked
└── Color: Dark gray, sliding panels

DOOR_AIRLOCK (3m x 2.5m x 0.5m)
├── Material: Reinforced metal
├── Vertices: ~80
├── Texture: door_airlock.png (128x128)
├── Features: Warning stripes, lights
└── Color: Yellow/black hazard
```

### Surface/Canyon Modules (Landfall, Brothers)

#### TERRAIN MODULES
```
TERRAIN_FLAT (10m x 10m)
├── Material: Rocky desert
├── Vertices: ~100 (subdivided)
├── Texture: terrain_rock.png (256x256)
└── Color: Rust brown (#8B5A2B)

TERRAIN_SLOPE (10m x 10m, 30° incline)
├── Material: Rocky desert
├── Vertices: ~100
├── Texture: terrain_rock.png
└── Color: Rust brown

TERRAIN_CLIFF (10m x 15m)
├── Material: Layered rock face
├── Vertices: ~200
├── Texture: cliff_face.png (256x256)
└── Color: Dark brown (#6B4423)
```

#### ROCK FORMATIONS
```
ROCK_PILLAR_SMALL (2m diameter, 5m tall)
├── Material: Desert rock
├── Vertices: ~60
├── Shape: Tapered cylinder, irregular
└── Color: Tan/brown

ROCK_PILLAR_LARGE (4m diameter, 15m tall)
├── Material: Desert rock
├── Vertices: ~120
├── Shape: Irregular column
└── Color: Tan/brown with red striations

ROCK_BOULDER (2-3m diameter)
├── Material: Desert rock
├── Vertices: ~40
├── Shape: Irregular sphere
└── Color: Gray-brown

ROCK_OUTCROP (5m x 3m x 4m)
├── Material: Layered rock
├── Vertices: ~80
├── Shape: Jagged horizontal layers
└── Color: Rust/brown layers
```

### FOB/Base Modules

#### PREFAB STRUCTURES
```
PREFAB_SMALL (4m x 4m x 3m)
├── Material: Military composite
├── Vertices: ~100
├── Texture: prefab_wall.png (128x128)
├── Features: Single door, no windows
└── Color: Olive drab (#4A4A32)

PREFAB_MEDIUM (8m x 6m x 3m)
├── Material: Military composite
├── Vertices: ~200
├── Texture: prefab_wall.png
├── Features: Door, 2 windows
└── Color: Olive drab

PREFAB_LARGE (12m x 8m x 4m)
├── Material: Military composite
├── Vertices: ~300
├── Texture: prefab_wall.png
├── Features: Double door, multiple windows
└── Color: Olive drab

PREFAB_HANGAR (20m x 15m x 6m)
├── Material: Corrugated metal
├── Vertices: ~400
├── Texture: hangar_wall.png (256x256)
├── Features: Large rolling door
└── Color: Gray-green
```

### Hive/Organic Modules (The Breach)

#### TUNNEL SEGMENTS
```
TUNNEL_STRAIGHT (4m diameter, 8m long)
├── Material: Organic chitin
├── Vertices: ~120
├── Shape: Irregular tube
├── Texture: hive_wall.png (128x128)
└── Color: Dark purple-brown (#3A2A3A)

TUNNEL_CURVE (4m diameter, 8m arc)
├── Material: Organic chitin
├── Vertices: ~180
├── Shape: Curved tube
└── Color: Dark purple-brown

TUNNEL_JUNCTION (4m diameter, 3 exits)
├── Material: Organic chitin
├── Vertices: ~250
├── Shape: Y-junction
└── Color: Dark purple-brown

TUNNEL_CHAMBER (8m diameter sphere)
├── Material: Organic, ribbed
├── Vertices: ~300
├── Shape: Irregular sphere
├── Features: Bioluminescent patches
└── Color: Purple-brown with blue glow spots
```

#### ORGANIC GROWTHS
```
GROWTH_SMALL (0.5m)
├── Material: Bioluminescent
├── Vertices: ~20
├── Shape: Mushroom/tendril
└── Color: Pale blue-green glow

GROWTH_CLUSTER (1-2m)
├── Material: Bioluminescent
├── Vertices: ~60
├── Shape: Multiple tendrils
└── Color: Blue-green glow

EGG_SINGLE (0.4m)
├── Material: Translucent organic
├── Vertices: ~30
├── Shape: Oval
└── Color: Pale yellow-green

EGG_CLUSTER (2m footprint)
├── Material: Organic
├── Vertices: ~150
├── Shape: 5-8 eggs in cluster
└── Color: Yellow-green, membrane between
```

---

## Props & Objects

### Station Props

```
CRATE_SMALL (0.5m cube)
├── Vertices: ~24
├── Texture: crate.png (64x64)
└── Color: Olive/tan

CRATE_MEDIUM (1m cube)
├── Vertices: ~24
├── Texture: crate.png
└── Color: Olive/tan

CRATE_LARGE (1m x 1m x 2m)
├── Vertices: ~24
├── Texture: crate.png
└── Color: Olive/tan

BARREL (0.5m diameter, 1m tall)
├── Vertices: ~32
├── Texture: barrel.png (64x64)
├── Variants: Standard, hazmat, fuel
└── Color: Gray, yellow stripes, red

TERMINAL (0.8m x 0.5m x 1.2m)
├── Vertices: ~60
├── Texture: terminal.png (64x64)
├── Features: Screen (emissive)
└── Color: Gray frame, green/blue screen

LOCKER (0.6m x 0.5m x 2m)
├── Vertices: ~40
├── Texture: locker.png (64x64)
├── States: Open, closed
├── Features: Suit visible when open
└── Color: Gray-green

WEAPON_RACK (2m x 0.5m x 1.5m)
├── Vertices: ~100
├── Texture: rack.png (64x64)
├── Features: 3 weapon slots
└── Color: Dark gray

CHAIR (0.5m x 0.5m x 1m)
├── Vertices: ~30
├── Texture: furniture.png (64x64)
└── Color: Gray/black

BENCH (2m x 0.5m x 0.5m)
├── Vertices: ~20
├── Texture: furniture.png
└── Color: Gray

TABLE_SMALL (1m x 1m x 0.8m)
├── Vertices: ~30
├── Texture: furniture.png
└── Color: Gray

TABLE_HOLOGRAM (2m diameter, 1m tall)
├── Vertices: ~60
├── Features: Projector base, hologram above
└── Color: Dark gray, blue hologram glow
```

### Military Props

```
SANDBAG_WALL (3m x 1m x 1m)
├── Vertices: ~80
├── Texture: sandbag.png (64x64)
└── Color: Tan/brown

BARRIER_CONCRETE (2m x 0.5m x 1m)
├── Vertices: ~30
├── Texture: concrete.png (64x64)
└── Color: Gray

BARRIER_METAL (3m x 0.1m x 1.5m)
├── Vertices: ~40
├── Texture: barrier.png (64x64)
├── Features: Warning stripes
└── Color: Yellow/black

COMM_TOWER (1m x 1m x 8m)
├── Vertices: ~100
├── Texture: metal.png (64x64)
├── Features: Antenna, dishes
└── Color: Gray, red light on top

GENERATOR (2m x 1m x 1.5m)
├── Vertices: ~80
├── Texture: machine.png (64x64)
├── Features: Vents, pipes
└── Color: Gray-green
```

### Vehicles

```
MECH_TITAN (3m x 4m x 8m - Marcus's mech)
├── Vertices: ~500
├── Texture: mech.png (256x256)
├── Features: Twin autocannons, missile pods
├── Animations: Walk, fire, damaged
└── Color: Military olive drab with unit markings

DROP_POD (2m diameter, 3m tall)
├── Vertices: ~150
├── Texture: pod.png (128x128)
├── States: Closed, open, interior visible
└── Color: Gray-white with heat scoring

DROPSHIP (15m x 10m x 5m - extraction)
├── Vertices: ~400
├── Texture: dropship.png (256x256)
├── Features: Troop bay, engines
└── Color: Gray military
```

---

## Characters & Enemies

### Human Characters

```
MARINE_STATIC (standing)
├── Vertices: ~300
├── Texture: marine.png (128x128)
├── Features: Combat armor, helmet, rifle
└── Color: Olive/gray armor

PLAYER_ARMS (first person)
├── Vertices: ~150
├── Texture: arms.png (64x64)
├── Features: Armored forearms, gloves
└── Color: Dark gray armor

COMMANDER_VASQUEZ (hologram/portrait)
├── Vertices: ~200 (if 3D)
├── Texture: vasquez.png (128x128)
├── Features: Officer uniform, serious expression
└── Color: Blue hologram tint
```

### Enemy: Chitin

```
CHITIN_DRONE
├── Size: 0.5-0.8m
├── Vertices: ~200
├── Texture: drone.png (64x64)
├── Health: 30 HP
├── Color: Purple-black
├── Behavior: Fast, swarm
└── Animations: Scurry, attack, death

CHITIN_GRUNT
├── Size: 1.5-1.8m
├── Vertices: ~350
├── Texture: grunt.png (128x128)
├── Health: 100 HP
├── Color: Dark gray-green
├── Behavior: Standard combat
└── Animations: Walk, run, attack, death

CHITIN_BRUTE
├── Size: 2.5-3m
├── Vertices: ~400
├── Texture: brute.png (128x128)
├── Health: 200 HP
├── Color: Deep red-brown
├── Behavior: Slow, charge attack
└── Animations: Walk, charge, slam, death

CHITIN_SPITTER
├── Size: 1.2-1.5m
├── Vertices: ~300
├── Texture: spitter.png (128x128)
├── Health: 50 HP
├── Color: Pale green
├── Behavior: Ranged acid attack
└── Animations: Idle, spit, death

CHITIN_QUEEN
├── Size: 4m+ (partially embedded)
├── Vertices: ~800
├── Texture: queen.png (256x256)
├── Health: 5000 HP
├── Color: Iridescent purple
├── Features: Spawns minions, multiple attack types
└── Animations: Idle, roar, spawn, attack, death
```

---

## Materials & Textures

### Color Palette

**Station Interior**
| Name | Hex | Usage |
|:-----|:----|:------|
| Panel Gray | #3A3A4A | Wall panels |
| Floor Dark | #2A2A2A | Floor grating |
| Accent Blue | #4A5A7A | Trim, lights |
| Warning Yellow | #C4A000 | Hazard stripes |
| Danger Red | #A03030 | Emergency lights |

**Planet Surface**
| Name | Hex | Usage |
|:-----|:----|:------|
| Rock Tan | #9B7B5A | Main terrain |
| Rock Brown | #6B4A2A | Shadows |
| Rock Red | #8B4A3A | Accent |
| Dust Orange | #C48A50 | Atmosphere |
| Sky Orange | #D47A3A | Sunset sky |

**FOB/Military**
| Name | Hex | Usage |
|:-----|:----|:------|
| Olive Drab | #4A4A32 | Main color |
| Military Gray | #505050 | Metal |
| Tan | #9A8A6A | Sandbags |
| Black | #1A1A1A | Shadows |

**Hive/Organic**
| Name | Hex | Usage |
|:-----|:----|:------|
| Chitin Dark | #3A2A3A | Main walls |
| Chitin Purple | #5A3A5A | Accents |
| Bio Glow | #4AC8C8 | Bioluminescence |
| Egg Yellow | #A0A050 | Eggs |

### Texture Requirements

1. **Format**: PNG with transparency where needed
2. **Sizes**: 32, 64, 128, or 256 pixels (power of 2)
3. **Style**: Hand-painted look, limited palette
4. **Tiling**: Most textures should tile seamlessly
5. **LOD**: Single resolution (no mipmaps for authentic look)

---

## Lighting Guidelines

### Station Lighting
- **Main**: Point lights every 4-6m along corridors
- **Color**: Warm white (FFE4C4) or cool blue (C4D4FF)
- **Intensity**: 1.0-1.5
- **Shadows**: Soft or none (performance)
- **Ambient**: 0.3-0.4 intensity

### Surface Lighting
- **Sun**: Directional light, orange-red tint
- **Direction**: Low angle (eternal sunset)
- **Color**: #FFA040
- **Intensity**: 2.0-2.5
- **Ambient**: 0.2-0.3 (harsh)

### FOB Lighting
- **Main**: Flickering point lights
- **Color**: Yellow-white (FFE0A0)
- **Intensity**: Variable (0.5-1.5, flickering)
- **Ambient**: 0.1-0.2 (dark, horror)
- **Effect**: Random flicker for tension

### Hive Lighting
- **Main**: Bioluminescent point lights
- **Color**: Cyan-blue (#40C0C0)
- **Intensity**: 0.5-1.0
- **Ambient**: 0.05-0.1 (very dark)
- **Glow**: Emissive materials on growths

---

## Assembly Examples

### Example: Station Corridor (30m long)

```javascript
// Corridor assembly pattern
function createCorridor(scene: Scene, length: number) {
  const segments = Math.ceil(length / 4); // 4m per segment

  for (let i = 0; i < segments; i++) {
    const z = i * 4;

    // Floor
    createFloorGrating(scene, { x: 0, y: 0, z });

    // Left wall
    createWallPanel(scene, { x: -2, y: 1.5, z }, { rotY: Math.PI / 2 });

    // Right wall (alternate types)
    if (i % 3 === 0) {
      createWallPiped(scene, { x: 2, y: 1.5, z }, { rotY: -Math.PI / 2 });
    } else {
      createWallPanel(scene, { x: 2, y: 1.5, z }, { rotY: -Math.PI / 2 });
    }

    // Ceiling with light every other segment
    if (i % 2 === 0) {
      createCeilingLight(scene, { x: 0, y: 3, z });
    } else {
      createCeilingStandard(scene, { x: 0, y: 3, z });
    }
  }
}
```

### Example: Canyon Scene

```javascript
// Canyon terrain assembly
function createCanyonArea(scene: Scene) {
  // Base terrain grid
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      createTerrainFlat(scene, { x: x * 10, y: 0, z: z * 10 });
    }
  }

  // Canyon walls
  createCliffWall(scene, { x: -60, y: 7.5, z: 0 }, { scaleZ: 10 });
  createCliffWall(scene, { x: 60, y: 7.5, z: 0 }, { scaleZ: 10, rotY: Math.PI });

  // Rock formations
  for (let i = 0; i < 20; i++) {
    const pos = randomPositionInArea(-50, 50, -50, 50);
    const type = Math.random() > 0.7 ? 'pillar_large' : 'boulder';
    createRock(scene, type, pos);
  }
}
```

### Example: Hive Tunnel Network

```javascript
// Hive tunnel assembly
function createHiveSection(scene: Scene) {
  // Main tunnel
  createTunnelStraight(scene, { x: 0, y: 0, z: 0 });
  createTunnelStraight(scene, { x: 0, y: 0, z: 8 });

  // Junction
  createTunnelJunction(scene, { x: 0, y: 0, z: 16 });

  // Branch tunnels
  createTunnelCurve(scene, { x: 6, y: 0, z: 20 }, { rotY: Math.PI / 4 });
  createTunnelCurve(scene, { x: -6, y: 0, z: 20 }, { rotY: -Math.PI / 4 });

  // Bioluminescent growths
  for (let i = 0; i < 15; i++) {
    const pos = randomTunnelWallPosition();
    createGrowthCluster(scene, pos);
  }

  // Egg clusters at junction
  createEggCluster(scene, { x: 2, y: 0, z: 18 });
  createEggCluster(scene, { x: -2, y: 0, z: 18 });
}
```

---

## Asset Checklist by Level

### Anchor Station
- [ ] Floor modules (standard, solid, hazard)
- [ ] Wall modules (standard, window, display, piped, door)
- [ ] Ceiling modules (standard, light)
- [ ] Door modules (single, double, airlock)
- [ ] Props (crates, terminals, lockers, racks, tables, chairs)
- [ ] Hologram table
- [ ] Drop pod
- [ ] Marine NPCs (static)
- [ ] Player arms (first person)

### Landfall
- [ ] Asteroid meshes (5-10 variants)
- [ ] Planet sphere (atmospheric shader)
- [ ] Player arms (skydiver pose)
- [ ] Thruster handles
- [ ] LZ pad
- [ ] Terrain modules (flat, slope, cliff)
- [ ] Rock formations (pillars, boulders)
- [ ] Chitin Drone
- [ ] Chitin Grunt

### FOB Delta
- [ ] Prefab structures (small, medium, large, hangar)
- [ ] Military props (sandbags, barriers, comm tower, generator)
- [ ] Interior modules (reuse station?)
- [ ] Damage decals (blood, scorches, holes)
- [ ] Marcus's mech (damaged state)
- [ ] All Chitin types

### Brothers in Arms
- [ ] Large canyon terrain
- [ ] The Breach (massive sinkhole)
- [ ] Marcus's mech (combat state)
- [ ] Bioluminescent growths (near Breach)
- [ ] All Chitin types in larger numbers

### The Breach
- [ ] Tunnel segments (straight, curve, junction, chamber)
- [ ] Organic growths
- [ ] Egg clusters
- [ ] Queen model
- [ ] All Chitin types
- [ ] Acid pool hazards
- [ ] Collapsing tunnel effects

### Extraction
- [ ] Collapsing tunnel variants
- [ ] LZ Omega area
- [ ] Dropship
- [ ] Marcus's mech (failing state)
- [ ] All Chitin types (max intensity)

---

*All assets should prioritize the PSX aesthetic over visual fidelity. Low poly counts and pixelated textures are features, not limitations.*
