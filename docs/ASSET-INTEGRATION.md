# Asset Integration Plan

## Overview
This document maps all available 3D assets and PBR textures to their usage across the 6-level campaign, ensuring maximum value extraction from our asset library.

## Color Philosophy

### Design Principle: Environment-Driven Aesthetics
Rather than dogmatic color rules, we use **contextually appropriate palettes** that serve narrative and psychological purposes:

- **Military Hardware** (mech, weapons, armor): Olive/khaki/brass - battle-worn, functional
- **Safe Spaces** (Anchor Station): Cool blues - psychologically calming for long deployments
- **Hostile Terrain** (planet surface): Harsh amber sun, dust, heat
- **Horror Zones** (FOB Delta): Flickering amber, emergency red
- **Alien Environments** (The Breach): Bioluminescent greens/purples - distinctly non-human

The "NO cyberpunk" guideline means avoiding **garish neon aesthetics**, not banning thoughtful color design.

---

## Environment Color Mapping

| Level | Location | Primary Palette | Psychological Intent |
|-------|----------|-----------------|---------------------|
| 1. Anchor Station | Staging base | Cool blue, clean white | Calm before the storm |
| 2. Landfall | Alien desert | Harsh amber, khaki dust | Hostile, exposed |
| 3. FOB Delta | Abandoned base | Flickering amber, red alerts | Dread, tension |
| 4. Brothers in Arms | Combat zone | Warm brass, fire, smoke | Intensity, brotherhood |
| 5. The Breach | Alien hive | Bioluminescent green/purple | Alien, oppressive |
| 6. Extraction | Collapsing hive | Red emergency, amber beacon | Desperate urgency |

---

## Texture Palette (Military Hardware)

For TEA military equipment (mech, weapons, vehicles, armor):

### Primary Textures
| Texture | Color | Use Case |
|---------|-------|----------|
| **PaintedMetal009** | Khaki/olive with rust | Main body paint for mech, vehicles |
| **Paint005** | Dark charcoal | Shadow areas, accent panels |
| **Metal007** | Brass/gold | Trim, insignia, accent hardware |

### Secondary/Detail Textures
| Texture | Color | Use Case |
|---------|-------|----------|
| **Metal010** | Brushed steel | Mechanical joints, pistons, hydraulics |
| **Metal017** | Dark corroded | Battle damage, heavy weathering |
| **PaintedMetal016** | Yellow/black stripes | Hazard/caution markings |
| **PaintedMetal018** | Military green (first aid) | Alternative olive panels |
| **Paint004** | Light gray | Weathered/faded areas |

### Texture File Paths
```
~/assets/AmbientCG/Assets/MATERIAL/1K-JPG/
├── Metal007/          # Brass accents
├── Metal010/          # Brushed steel
├── Metal017/          # Corroded metal
├── Paint005/          # Dark charcoal
├── PaintedMetal009/   # Khaki with rust
├── PaintedMetal016/   # Hazard stripes
└── PaintedMetal018/   # Military green
```

Each folder contains full PBR set: Color, Normal, Roughness, Metalness, AO, Displacement

---

## Integrated Models (public/assets/models/)

### Aliens (8 models) - `public/assets/models/enemies/chitin/`
| Model | Size | Enemy Type | Levels |
|-------|------|------------|--------|
| scout.glb | 1.6MB | Drone - fast, weak scouts | 2, 3, 4, 5, 6 |
| soldier.glb | 1.6MB | Grunt - standard melee | 2, 3, 4, 5, 6 |
| spider.glb | 1.5MB | Crawler - wall/ceiling | 3, 5 |
| flyingalien.glb | 1.4MB | Spitter - ranged aerial | 2, 4, 6 |
| alienmonster.glb | 5.9MB | Brute - heavy, slow | 3, 4, 5 |
| tentakel.glb | 1.5MB | Tentacle hazard | 5 |
| alienfemale.glb | 3.3MB | Elite variant | 4, 5 |
| alienmale.glb | 2.2MB | Elite variant | 4, 5, 6 |

### Alien Structures (7 models) - `public/assets/models/structures/`
| Model | Size | Purpose | Levels |
|-------|------|---------|--------|
| building_birther.glb | 4.3MB | Enemy spawner | 5 (The Breach) |
| building_brain.glb | 1.1MB | Hive mind objective | 5 (Queen chamber) |
| building_claw.glb | 5.5MB | Defensive structure | 4, 5 |
| building_crystals.glb | 0.4MB | Energy/resource node | 3, 5 |
| building_stomach.glb | 5.7MB | Organic processing | 5 |
| building_terraformer.glb | 2.2MB | Environmental hazard | 2, 3 |
| building_undercrystal.glb | 1.6MB | Underground variant | 5 |

### Vehicles (2 models) - `public/assets/models/vehicles/`
| Model | Size | Purpose | Levels |
|-------|------|---------|--------|
| phantom.glb | 11.3MB | Dropship/extraction vehicle | 1, 6 |
| wraith.glb | 11.9MB | Enemy heavy vehicle | 4, 6 |

### PSX Station Models - `public/assets/models/psx/`

#### Structures (11 pieces)
| Model | Use Case |
|-------|----------|
| wall_hr_1_double.glb | Standard corridor walls |
| wall_hr_1_hole_1.glb | Damaged/breached walls |
| floor_ceiling_hr_1.glb | Basic floor/ceiling tiles |
| floor_ceiling_hr_3.glb | Variant floor tiles |
| floor_ceiling_rtx_1.glb | High-detail floor |
| doorway_hr_1.glb | Standard doorframe |
| doorway_hr_1_wide.glb | Wide doorframe |
| beam_hc_horizontal_1.glb | Structural beams |
| beam_hc_vertical_1.glb | Support columns |
| pipe_cx_1.glb | Industrial piping |
| pipe_cx_2.glb | Piping variant |

#### Doors (3 variants)
- door_hr_6.glb, door_hr_12.glb, door_hr_13.glb

#### Lights (3 variants)
- lamp_mx_1_a_on.glb, lamp_mx_2_on.glb, lamp_mx_3_on.glb

#### Props (7 items)
- cardboard_box_1.glb - Storage
- electrical_equipment_1.glb - Tech panels
- machinery_mx_1.glb - Industrial equipment
- metal_barrel_hr_1.glb, metal_barrel_hr_2.glb - Storage/cover
- pipes_hr_1.glb - Small pipes
- shelf_mx_1.glb - Storage shelving

---

## Assets Requiring Conversion

### 1. Marcus Mech (PRIORITY)
**Source:** `~/assets/full bot.blend`
**Target:** `public/assets/models/vehicles/marcus_mech.glb`
**Stats:** 42 meshes, 1 material (needs texturing), has armature

**Texturing Plan:**
- Body panels: PaintedMetal009 (khaki/olive with battle damage)
- Joints/hydraulics: Metal010 (brushed steel)
- Trim/insignia: Metal007 (brass)
- Cockpit frame: Paint005 (dark charcoal)
- Hazard markings: PaintedMetal016 (yellow/black stripes)
- Heavy weathering: Metal017 (corroded)

**Export Settings:**
- Format: GLB (binary GLTF)
- Include: Armature, animations
- Compression: Draco

### 2. Spaceship Corridors (Anchor Station)
**Source:** `~/assets/assets spaceship/`
**Target:** `public/assets/models/station/`

| FBX File | Target GLB | Notes |
|----------|------------|-------|
| hallway 1.fbx | corridor_main.glb | Main corridor segment |
| hallway 2.fbx | corridor_junction.glb | T-junction |
| hallway 3.fbx | corridor_corner.glb | Corner piece |
| hallway 4.fbx | corridor_wide.glb | Wide variant |
| door.fbx | station_door.glb | Automated door |
| barrel.fbx | station_barrel.glb | Storage prop |

**Design Decision:** KEEP the blue accent lighting!
- Anchor Station is a rotating staging base where marines rest before deployment
- Cool blue lighting is psychologically calming for long deployment periods
- Creates strong contrast with the harsh amber alien sun they'll face on Landfall
- Reinforces the "leaving home" feeling when dropping to the planet

---

## Level Asset Mapping

### Level 1: Anchor Station Prometheus (Tutorial)
**Primary Assets:**
- Spaceship corridors (converted from FBX)
- PSX structures (walls, floors, doorways)
- PSX props (equipment, barrels, shelves)
- PSX lights (lamps)
- phantom.glb (docked dropship visible through windows)

**Atmosphere:** Cool blue accent lighting, clean white panels
**Psychology:** Calming staging environment - the calm before the storm
**Contrast:** Marines leave blue safety → drop into harsh amber alien sun

### Level 2: Landfall (HALO Drop)
**Primary Assets:**
- building_terraformer.glb (environmental)
- scout.glb, soldier.glb (first enemies)
- flyingalien.glb (aerial threats)
- building_crystals.glb (alien presence markers)

**Atmosphere:** Harsh alien sun, desert/canyon terrain

### Level 3: FOB Delta (Horror/Investigation)
**Primary Assets:**
- PSX structures (damaged/abandoned)
- PSX props (scattered, destroyed)
- alienmonster.glb (brute ambush)
- spider.glb (ceiling crawlers)
- building_crystals.glb (infestation spread)
- building_terraformer.glb (corrupted equipment)

**Atmosphere:** Dark, flickering lights, horror tension

### Level 4: Brothers in Arms (Marcus + Wave Combat)
**Primary Assets:**
- marcus_mech.glb (allied NPC - MARCUS)
- All alien enemy types
- building_claw.glb (defensive objectives)
- wraith.glb (enemy heavy assault)

**Atmosphere:** Intense combat, defensive positions

### Level 5: The Breach (Hive + Queen Boss)
**Primary Assets:**
- ALL alien structures (full hive environment)
- building_brain.glb (Queen chamber centerpiece)
- building_birther.glb (spawner waves)
- alienmonster.glb, alienfemale.glb, alienmale.glb (elite guards)
- spider.glb, tentakel.glb (environmental hazards)

**Atmosphere:** Organic, alien, oppressive

### Level 6: Extraction (Escape Sequence)
**Primary Assets:**
- phantom.glb (extraction vehicle - objective)
- wraith.glb (pursuing enemies)
- All alien enemy types (final waves)
- alienmale.glb, alienfemale.glb (elite pursuers)

**Atmosphere:** Desperate escape, collapsing hive

---

## Conversion Pipeline

### Blender Export Settings (GLB)
```python
bpy.ops.export_scene.gltf(
    filepath="output.glb",
    export_format='GLB',
    export_texcoords=True,
    export_normals=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_animations=True,
    export_skins=True
)
```

### FBX to GLB Workflow
1. Import FBX into Blender
2. Verify scale (1 unit = 1 meter)
3. Recolor blue materials to amber (#D4A84B)
4. Apply PBR textures where needed
5. Export as GLB with Draco compression

---

## Integration Checklist

### Immediate (Required for Playable Game)
- [x] Alien enemies integrated (8 models)
- [x] Alien structures integrated (7 models)
- [x] PSX station assets integrated (24+ models)
- [x] Vehicles integrated (phantom, wraith)
- [x] Marcus mech conversion and texturing (marcus_mech.glb - 0.56MB)
- [x] Spaceship corridor conversion (6 models - ~21MB total)

### Station Models - `public/assets/models/environment/station/`
| Model | Size | Purpose |
|-------|------|---------|
| corridor_main.glb | 7.4MB | Main corridor segment |
| corridor_junction.glb | 3.9MB | T-junction variant |
| corridor_corner.glb | 4.3MB | Corner piece |
| corridor_wide.glb | 4.3MB | Wide variant |
| station_door.glb | 143KB | Animated door |
| station_barrel.glb | 113KB | Storage prop |
| wall_hr_1_double.glb | 994KB | Wall panel |
| doorway_hr_1.glb | 1.6MB | Doorframe |
| floor_ceiling_hr_1.glb | 556KB | Floor/ceiling tile |
| beam_hc_vertical_1.glb | 495KB | Support beam |
| pipe_cx_1.glb | 1.2MB | Industrial pipe |

**MODULAR SYSTEM:** All corridors are 4.0 units long (Y-axis) for snap-together level design!

### NEW Directory Structure
```
public/assets/models/
├── enemies/
│   └── chitin/           # 8 alien enemy models
├── environment/
│   ├── station/          # Anchor Station corridors & structures
│   └── hive/             # Alien hive structures (7 models)
├── props/
│   └── industrial/       # Doors, lights, barrels (13 models)
└── vehicles/
    ├── tea/              # TEA military (marcus_mech, phantom)
    └── chitin/           # Alien vehicles (wraith)
```

### Polish Phase
- [ ] Apply weathering textures to all military assets
- [ ] Add hazard stripe decals to mech
- [ ] Create damaged variants of station pieces
- [ ] LOD generation for mobile performance

---

## File Size Budget

| Category | Current | Budget | Status |
|----------|---------|--------|--------|
| Aliens | 19MB | 25MB | ✅ Under |
| Structures | 21MB | 30MB | ✅ Under |
| Vehicles | 23MB | 30MB | ✅ Under |
| PSX Assets | ~8MB | 15MB | ✅ Under |
| **Total** | **71MB** | **100MB** | ✅ Under |

*Note: Marcus mech estimated at 3-5MB after optimization*

---

## GenAI Asset Generation

### Overview
AI-generated assets (portraits, videos, cinematics) are managed through a manifest-driven CLI system using Google's Gemini API for images and Veo 3.1 for video generation.

### Asset Directory Structure
```
public/assets/
├── images/
│   ├── portraits/
│   │   ├── manifest.json           # Portrait generation manifest
│   │   ├── cole_james/
│   │   │   ├── neutral.png
│   │   │   ├── combat.png
│   │   │   └── injured.png
│   │   ├── marcus/
│   │   ├── reyes_commander/
│   │   └── athena/
│   ├── quest/                      # Quest/loading screen images
│   └── ui/                         # UI background images
├── videos/
│   ├── splash/
│   │   ├── manifest.json           # Splash video manifest
│   │   ├── logo_16x9.mp4
│   │   └── logo_9x16.mp4
│   └── cinematics/
│       ├── manifest.json           # Cinematic manifest
│       ├── anchor_station/
│       │   └── intro.mp4
│       └── landfall/
│           └── intro.mp4
└── manifests/
    ├── shared.manifest.json
    └── anchor_station.manifest.json
```

### CLI Commands
```bash
# Generate specific asset categories
pnpm exec tsx scripts/generate-assets.ts portraits          # All portraits
pnpm exec tsx scripts/generate-assets.ts portraits 0        # First portrait only
pnpm exec tsx scripts/generate-assets.ts portraits cole     # By ID match
pnpm exec tsx scripts/generate-assets.ts splash             # Splash videos
pnpm exec tsx scripts/generate-assets.ts splash 16:9        # Specific aspect ratio
pnpm exec tsx scripts/generate-assets.ts cinematics         # Level cinematics
pnpm exec tsx scripts/generate-assets.ts cinematics anchor_station  # By level

# Generate all assets
pnpm exec tsx scripts/generate-assets.ts all

# Check generation status
pnpm exec tsx scripts/generate-assets.ts status

# Force regeneration (ignores cache)
pnpm exec tsx scripts/generate-assets.ts portraits --force
```

### Manifest Schema
Each manifest file follows a Zod-validated schema with:
- Asset definitions (id, prompt, resolution, aspect ratio)
- Generation metadata (promptHash, generatedAt, model used)
- Status tracking (pending, generating, generated, failed)
- Lore branding (unit patches, rank insignia for portraits)

### Idempotency
The system uses SHA-256 prompt hashing for idempotency:
1. Prompts are hashed before generation
2. Hash is stored in asset metadata after generation
3. On subsequent runs, prompt hash is compared
4. Assets only regenerate when prompts change or `--force` is used

### VCR Testing for CI
GenAI API calls are recorded using Polly.JS for deterministic CI testing:
```bash
# Record new API responses (requires API key)
VCR_MODE=record pnpm test

# Replay recorded responses (default, no API key needed)
VCR_MODE=replay pnpm test

# Pass through to real API (for manual testing)
VCR_MODE=passthrough pnpm test
```

Recordings are stored in `src/test/vcr/__recordings__/` with API keys automatically sanitized.

### Environment Variables
```bash
# Required for generation (not needed for replay tests)
GEMINI_API_KEY=your_api_key_here

# Optional: verbose logging
VERBOSE=1
```

### Video Generation Config (Veo 3.1)
- Resolution: 1080p native HD
- Duration: 8 seconds
- Audio: Native 48kHz synchronized audio
- Aspect ratios: 16:9 (landscape), 9:16 (portrait/mobile)
